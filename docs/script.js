const CardJsonDatabase = {
  storageKey: 'itw-tcg-card-editor-db-v2',
  legacyStorageKey: 'itw-tcg-card-editor-record-v1',

  loadState() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (this.isValidDbState(parsed)) {
          return parsed;
        }
      } catch {
        // Fall through to legacy key migration on parse error.
      }
    }

    const legacyRaw = localStorage.getItem(this.legacyStorageKey);
    if (!legacyRaw) return null;

    try {
      const record = JSON.parse(legacyRaw);
      if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
      const id = this.generateId();
      return {
        activeCardId: id,
        cards: [{ id, name: this.getCardName(record, 0), record }]
      };
    } catch {
      return null;
    }
  },

  saveState(state) {
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  },

  isValidDbState(state) {
    return Boolean(state && Array.isArray(state.cards) && state.cards.length && typeof state.activeCardId === 'string');
  },

  getCardName(record, index) {
    const raw = String(record?.['card-name'] || '').trim();
    return raw || `Card ${index + 1}`;
  },

  generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `card-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const CARD_RECORD_KEYS = new Set([
  'card-name',
  'scientific-name',
  'flora',
  'water',
  'fauna',
  'attack',
  'health',
  'expansion',
  'artist',
  'card-type',
  'fact',
  'abilities',
  'artwork'
]);

const CardEditor = {
  svgDocument: null,
  svgRoot: null,
  currentArtworkPath: '',
  artworkRequestId: 0,
  dbState: null,

  textFieldMap: {
    'card-name': 'card-name',
    'scientific-name': 'scientific-name',
    'flora': 'flora',
    'water': 'water',
    'fauna': 'fauna',
    'attack': 'attack',
    'health': 'health',
    'expansion': 'expansion',
    'artist': 'artist'
  },

  multilineFieldConfig: {
    fact: { id: 'fact', maxWidth: 335, lineHeight: 11.53, maxLines: 7, x: '58.914871', y: 402.32617 },
    abilities: { id: 'abilities', maxWidth: 320, lineHeight: 13.0, maxLines: 6, x: '64.4', y: 467.8 }
  },

  init() {
    this.loadEmbeddedSVG();
    this.bindEvents();
    this.initializeDatabase();
    this.restoreSavedRecord();
  },

  loadEmbeddedSVG() {
    const raw = document.getElementById('svg-template')?.textContent || '';
    if (!raw.trim()) {
      $('#svg-preview').text('Embedded SVG template not found.');
      return;
    }

    const parser = new DOMParser();
    this.svgDocument = parser.parseFromString(raw, 'image/svg+xml');
    this.svgRoot = this.svgDocument.documentElement;
    this.renderPreview();
  },

  bindEvents() {
    $('#card-editor-form').on('input change', 'input[type="text"], input[type="number"], textarea', (event) => {
      const fieldName = event.target.name;
      const value = $(event.target).val();

      if (fieldName === 'fact' || fieldName === 'abilities') {
        this.updateMultilineField(fieldName, value);
      } else if (fieldName === 'card-type') {
        this.updatePrefixedField('card-type', 'Type: ', value);
      } else {
        this.updateField(fieldName, value);
      }

      this.renderPreview();
      this.persistRecord();
    });

    // Only track the path as the user types; avoid fetching/validating on
    // every keystroke (which caused repeated alert popups). The artwork is
    // actually loaded once the field loses focus (`change`) or on save.
    $('#artwork-path-input').on('input', (event) => {
      this.currentArtworkPath = event.target.value.trim();
      this.persistRecord();
    });

    $('#artwork-path-input').on('change', (event) => {
      this.currentArtworkPath = event.target.value.trim();
      this.loadArtworkFromPath(this.currentArtworkPath);
      this.persistRecord();
    });

    $('#import-json-button').on('click', () => $('#import-json-input').trigger('click'));
    $('#import-json-input').on('change', (event) => this.importJSON(event));
    $('#save-svg-button').on('click', () => this.saveSVG());
    $('#save-card-button').on('click', () => this.saveCurrentCard());
    $('#new-card-button').on('click', () => this.newCard());
    $('#duplicate-card-button').on('click', () => this.duplicateCard());
    $('#export-deck-button').on('click', () => this.exportDeck());
    $('#remove-card-button').on('click', () => this.removeCard());
    $('#saved-cards-select').on('change', () => this.loadSelectedCard());
  },

  updateField(fieldName, value) {
    const id = this.textFieldMap[fieldName];
    if (!id || !this.svgRoot) return;
    const node = this.svgRoot.getElementById(id);
    if (!node) return;
    node.textContent = value || '';
  },

  updatePrefixedField(id, prefix, value) {
    if (!this.svgRoot) return;
    const node = this.svgRoot.getElementById(id);
    if (!node) return;
    node.textContent = `${prefix}${value || ''}`;
  },

  updateMultilineField(fieldName, value) {
    const config = this.multilineFieldConfig[fieldName];
    if (!config || !this.svgRoot) return;

    const textElement = this.svgRoot.getElementById(config.id);
    if (!textElement) return;

    while (textElement.firstChild) textElement.removeChild(textElement.firstChild);

    const lines = this.wrapText(value || '', config.maxWidth, textElement, config.maxLines);
    lines.forEach((line, index) => {
      const tspan = this.svgDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.setAttribute('x', config.x);
      tspan.setAttribute('y', (config.y + index * config.lineHeight).toFixed(2));
      tspan.textContent = line;
      textElement.appendChild(tspan);
    });
  },

  wrapText(rawText, maxWidth, textElement, maxLines) {
    const paragraphs = rawText.replace(/\r/g, '').split('\n');
    const result = [];

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        result.push('');
        continue;
      }

      const words = paragraph.split(/\s+/);
      let current = '';

      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (this.measureSvgTextWidth(candidate, textElement) <= maxWidth) {
          current = candidate;
        } else {
          if (current) result.push(current);
          current = word;
        }
      }

      if (current) result.push(current);
      if (result.length >= maxLines) break;
    }

    return (result.length ? result : ['']).slice(0, maxLines);
  },

  measureSvgTextWidth(text, referenceTextElement) {
    const temp = this.svgDocument.createElementNS('http://www.w3.org/2000/svg', 'text');
    temp.setAttribute('font-size', referenceTextElement.getAttribute('font-size') || '10');
    temp.setAttribute('font-family', referenceTextElement.getAttribute('font-family') || 'sans-serif');
    temp.setAttribute('font-weight', referenceTextElement.getAttribute('font-weight') || 'normal');
    temp.textContent = text;

    this.svgRoot.appendChild(temp);
    const width = temp.getComputedTextLength();
    this.svgRoot.removeChild(temp);
    return width;
  },

  loadArtworkFromPath(path) {
    const requestId = ++this.artworkRequestId;

    if (!path) {
      this.inlineArtworkSvg('');
      this.renderPreview();
      return;
    }

    fetch(path)
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.text();
      })
      .then((svgText) => {
        if (requestId !== this.artworkRequestId) return;
        this.inlineArtworkSvg(svgText);
        this.renderPreview();
      })
      .catch(() => {
        if (requestId !== this.artworkRequestId) return;
        // Silently clear the preview instead of alerting; the path may
        // simply be incomplete while the user is still typing/editing.
        console.warn(`Unable to load artwork from path: ${path}`);
        this.inlineArtworkSvg('');
        this.renderPreview();
      });
  },

  inlineArtworkSvg(svgText) {
    if (!this.svgRoot) return;
    const existing = this.svgRoot.getElementById('artwork');
    if (!existing) return;

    const x = existing.getAttribute('x') || '49.098';
    const y = existing.getAttribute('y') || '100.04';
    const width = existing.getAttribute('width') || '351.81';
    const height = existing.getAttribute('height') || '205.38';

    if (!svgText) {
      // Restore empty image placeholder when artwork is cleared.
      if (existing.tagName !== 'image') {
        const img = this.svgDocument.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('id', 'artwork');
        img.setAttribute('x', x);
        img.setAttribute('y', y);
        img.setAttribute('width', width);
        img.setAttribute('height', height);
        img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
        existing.parentNode.replaceChild(img, existing);
      }
      return;
    }

    const parser = new DOMParser();
    const artDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const artSvg = artDoc.documentElement;
    if (!artSvg || artSvg.tagName.toLowerCase() === 'parsererror' || artDoc.querySelector('parsererror')) {
      // Silently clear the preview instead of alerting; this avoids popup
      // spam while the artwork path is still being edited.
      console.warn('The artwork file contains invalid SVG syntax.');
      this.inlineArtworkSvg('');
      return;
    }

    this.sanitizeSvgDoc(artDoc);

    const nestedSvg = this.svgDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
    nestedSvg.setAttribute('id', 'artwork');
    nestedSvg.setAttribute('x', x);
    nestedSvg.setAttribute('y', y);
    nestedSvg.setAttribute('width', width);
    nestedSvg.setAttribute('height', height);
    nestedSvg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const viewBox = artSvg.getAttribute('viewBox');
    if (viewBox) nestedSvg.setAttribute('viewBox', viewBox);

    Array.from(artSvg.childNodes).forEach((child) => {
      nestedSvg.appendChild(this.svgDocument.importNode(child, true));
    });

    existing.parentNode.replaceChild(nestedSvg, existing);
  },

  sanitizeSvgDoc(doc) {
    const BLOCKED_TAGS = ['script', 'foreignObject', 'embed', 'object', 'iframe'];
    const EVENT_ATTR = /^on/i;
    // Block non-image data URIs and javascript: URIs; allow data:image/ for embedded rasters.
    const UNSAFE_URI = /^\s*(?:javascript:|data:(?!image\/))/i;
    const HREF_ATTRS = ['href', 'xlink:href', 'src', 'action'];

    BLOCKED_TAGS.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    });

    doc.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (EVENT_ATTR.test(attr.name)) {
          el.removeAttribute(attr.name);
        } else if (HREF_ATTRS.includes(attr.name) && UNSAFE_URI.test(attr.value)) {
          el.removeAttribute(attr.name);
        }
      });
    });
  },

  getCurrentRecord() {
    const record = {};
    $('#card-editor-form').serializeArray().forEach(({ name, value }) => {
      record[name] = value;
    });
    record.artwork = this.currentArtworkPath || '';
    return record;
  },

  applyRecord(record) {
    if (!record) return;

    [...Object.keys(this.textFieldMap), 'card-type', 'fact', 'abilities'].forEach((fieldName) => {
      const value = record[fieldName] ?? '';
      const $input = $(`#card-editor-form [name="${fieldName}"]`);
      if ($input.length) $input.val(value);
    });

    Object.keys(this.textFieldMap).forEach((fieldName) => {
      this.updateField(fieldName, record[fieldName] ?? '');
    });
    this.updatePrefixedField('card-type', 'Type: ', record['card-type'] ?? '');
    this.updateMultilineField('fact', record.fact ?? '');
    this.updateMultilineField('abilities', record.abilities ?? '');

    this.currentArtworkPath = record.artwork || '';
    $('#artwork-path-input').val(this.currentArtworkPath);
    this.loadArtworkFromPath(this.currentArtworkPath);
    this.renderPreview();
  },

  initializeDatabase() {
    this.dbState = CardJsonDatabase.loadState();
    if (!CardJsonDatabase.isValidDbState(this.dbState)) {
      const record = this.getCurrentRecord();
      const id = CardJsonDatabase.generateId();
      this.dbState = {
        activeCardId: id,
        cards: [{ id, name: CardJsonDatabase.getCardName(record, 0), record }]
      };
      CardJsonDatabase.saveState(this.dbState);
    }
    if (!this.dbState.cards.some((card) => card.id === this.dbState.activeCardId)) {
      this.dbState.activeCardId = this.dbState.cards[0].id;
    }
    this.renderSavedCardList();
  },

  getActiveCard() {
    if (!this.dbState) return null;
    return this.dbState.cards.find((card) => card.id === this.dbState.activeCardId) || null;
  },

  getActiveCardEntry() {
    if (!this.dbState) return null;
    const index = this.dbState.cards.findIndex((card) => card.id === this.dbState.activeCardId);
    if (index < 0) return null;
    return { card: this.dbState.cards[index], index };
  },

  renderSavedCardList() {
    if (!this.dbState) return;
    const $select = $('#saved-cards-select');
    $select.empty();

    this.dbState.cards.forEach((card, index) => {
      const option = document.createElement('option');
      option.value = card.id;
      option.textContent = card.name || CardJsonDatabase.getCardName(card.record, index);
      if (card.id === this.dbState.activeCardId) option.selected = true;
      $select.append(option);
    });

    $('#card-count').text(this.dbState.cards.length);
  },

  saveDatabase() {
    if (!this.dbState) return;
    CardJsonDatabase.saveState(this.dbState);
    this.renderSavedCardList();
  },

  sanitizeFilename(name) {
    const sanitized = String(name || 'card')
      .replace(/[^a-z0-9-_]+/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    return sanitized || 'card';
  },

  persistRecord() {
    if (!this.dbState) return;
    const activeEntry = this.getActiveCardEntry();
    if (!activeEntry) return;
    const record = this.getCurrentRecord();
    activeEntry.card.record = record;
    activeEntry.card.name = CardJsonDatabase.getCardName(record, activeEntry.index);
    this.saveDatabase();
  },

  restoreSavedRecord() {
    const activeCard = this.getActiveCard();
    if (activeCard?.record) this.applyRecord(activeCard.record);
  },

  saveCurrentCard() {
    this.loadArtworkFromPath(this.currentArtworkPath);
    this.persistRecord();
  },

  newCard() {
    if (!this.dbState) return;
    const record = {};
    const id = CardJsonDatabase.generateId();
    let n = this.dbState.cards.length + 1;
    while (this.dbState.cards.some((c) => c.name === `Card ${n}`)) n++;
    this.dbState.cards.push({ id, name: `Card ${n}`, record });
    this.dbState.activeCardId = id;
    this.saveDatabase();
    this.applyRecord(record);
  },

  duplicateCard() {
    if (!this.dbState) return;
    const record = this.getCurrentRecord();
    const id = CardJsonDatabase.generateId();
    this.dbState.cards.push({
      id,
      name: CardJsonDatabase.getCardName(record, this.dbState.cards.length),
      record
    });
    this.dbState.activeCardId = id;
    this.saveDatabase();
  },

  loadSelectedCard() {
    if (!this.dbState) return;
    const selectedId = String($('#saved-cards-select').val() || '');
    if (!selectedId) return;
    const selectedCard = this.dbState.cards.find((card) => card.id === selectedId);
    if (!selectedCard) return;
    this.dbState.activeCardId = selectedId;
    this.saveDatabase();
    this.applyRecord(selectedCard.record || {});
  },

  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  removeCard() {
    if (!this.dbState) return;
    if (this.dbState.cards.length <= 1) {
      alert('Cannot remove the last card in the library.');
      return;
    }

    const selectedId = String($('#saved-cards-select').val() || this.dbState.activeCardId || '');
    const index = this.dbState.cards.findIndex((card) => card.id === selectedId);
    if (index < 0) return;

    this.dbState.cards.splice(index, 1);
    const nextCard = this.dbState.cards[Math.max(0, index - 1)];
    if (!nextCard) return;
    this.dbState.activeCardId = nextCard.id;
    this.saveDatabase();
    this.restoreSavedRecord();
  },

  exportDeck() {
    if (!this.dbState) return;
    const deck = this.dbState.cards.map((card, index) => ({
      'card-number': String(index + 1),
      ...(card.record || {})
    }));
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    this._triggerDownload(blob, 'deck.json');
  },

  importJSON(event) {
    const file = event.target.files && event.target.files[0];
    // Reset so selecting the same file again still triggers change.
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '').trim();
      if (!raw) {
        alert('Error: JSON file is empty. Please provide valid card data.');
        return;
      }

      try {
        const parsed = JSON.parse(raw);

        // Deck array import
        if (Array.isArray(parsed)) {
          if (!parsed.length) {
            alert('Error: Deck JSON array is empty.');
            return;
          }
          const invalidIndex = parsed.findIndex((item) => !item || typeof item !== 'object' || Array.isArray(item));
          if (invalidIndex !== -1) {
            alert(`Error: Item at index ${invalidIndex} in the deck array is not a valid card object.`);
            return;
          }
          if (!confirm(`Import ${parsed.length} card(s)? This will replace your current card library.`)) return;

          const cards = parsed.map((record, index) => {
            // Strip auto-generated card-number so it stays computed on export
            const { 'card-number': _n, ...rest } = record;
            const id = CardJsonDatabase.generateId();
            return { id, name: CardJsonDatabase.getCardName(rest, index), record: rest };
          });
          this.dbState.cards = cards;
          this.dbState.activeCardId = cards[0].id;
          this.saveDatabase();
          this.applyRecord(cards[0].record);
          return;
        }

        // Single card object import
        if (!this.isValidRecord(parsed)) {
          alert('Error: JSON data must include at least one of these fields: "card-name", "scientific-name", "fact", "abilities", "attack", "health", "flora", "water", or "fauna", and only known card data keys.');
          return;
        }
        this.applyRecord(parsed);
        this.persistRecord();
      } catch (error) {
        alert(`Error: Failed to parse JSON file: ${error instanceof Error ? error.message : 'unknown parse error'}`);
      }
    };
    reader.readAsText(file);
  },

  isValidRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
    const keys = Object.keys(record);
    if (!keys.length) return false;
    if (keys.some((key) => !CARD_RECORD_KEYS.has(key))) return false;
    if ('artwork' in record && typeof record.artwork !== 'string') return false;
    return ['card-name', 'scientific-name', 'fact', 'abilities', 'attack', 'health', 'flora', 'water', 'fauna'].some((key) => key in record);
  },

  renderPreview() {
    if (!this.svgRoot) return;
    const markup = new XMLSerializer().serializeToString(this.svgRoot);
    $('#svg-preview').html(markup);
  },

  saveSVG() {
    if (!this.svgRoot) return;
    const output = new XMLSerializer().serializeToString(this.svgRoot);
    const blob = new Blob([output], { type: 'image/svg+xml;charset=utf-8' });
    const activeCard = this.getActiveCard();
    const filename = `${this.sanitizeFilename(activeCard?.name || 'card')}.svg`;
    this._triggerDownload(blob, filename);
  }
};

$(document).ready(() => CardEditor.init());
