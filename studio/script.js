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
  'card-number',
  'artist',
  'card-type',
  'card-habitat',
  'fact',
  'abilities',
  'artworkDataUri'
]);

const CardEditor = {
  svgDocument: null,
  svgRoot: null,
  currentArtworkDataUri: '',
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
    'card-number': 'card-number',
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
      } else if (fieldName === 'card-habitat') {
        this.updatePrefixedField('card-habitat', 'Habitat: ', value);
      } else {
        this.updateField(fieldName, value);
      }

      this.renderPreview();
      this.persistRecord();
    });

    $('#artwork-input').on('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      this.updateArtwork(file);
    });

    $('#export-json-button').on('click', () => this.exportJSON());
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

  updateArtwork(file) {
    const valid = ['image/jpeg', 'image/png', 'image/webp'];
    if (!valid.includes(file.type)) {
      alert('Invalid file type. Please select JPG, PNG, or WebP.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result;
      this.currentArtworkDataUri = dataUri;
      const artwork = this.svgRoot.getElementById('artwork');
      if (!artwork) return;

      this.setSvgImageHref(artwork, dataUri);

      this.renderPreview();
      this.persistRecord();
    };
    reader.readAsDataURL(file);
  },

  applyArtworkDataUri(dataUri) {
    const artwork = this.svgRoot.getElementById('artwork');
    if (!artwork) return;
    const safe = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(dataUri) ? dataUri : '';
    this.setSvgImageHref(artwork, safe);
  },

  setSvgImageHref(node, href) {
    node.setAttribute('href', href);
    // Keep xlink:href for SVG viewers that still rely on legacy namespace resolution.
    node.setAttributeNS('http://www.w3.org/1999/xlink', 'href', href);
  },

  getCurrentRecord() {
    const record = {};
    $('#card-editor-form').serializeArray().forEach(({ name, value }) => {
      record[name] = value;
    });
    record.artworkDataUri = this.currentArtworkDataUri || '';
    return record;
  },

  applyRecord(record) {
    if (!record) return;

    [...Object.keys(this.textFieldMap), 'card-type', 'card-habitat', 'fact', 'abilities'].forEach((fieldName) => {
      const value = record[fieldName] ?? '';
      const $input = $(`#card-editor-form [name="${fieldName}"]`);
      if ($input.length) $input.val(value);
    });

    Object.keys(this.textFieldMap).forEach((fieldName) => {
      this.updateField(fieldName, record[fieldName] ?? '');
    });
    this.updatePrefixedField('card-type', 'Type: ', record['card-type'] ?? '');
    this.updatePrefixedField('card-habitat', 'Habitat: ', record['card-habitat'] ?? '');
    this.updateMultilineField('fact', record.fact ?? '');
    this.updateMultilineField('abilities', record.abilities ?? '');

    this.currentArtworkDataUri = record.artworkDataUri || '';
    this.applyArtworkDataUri(this.currentArtworkDataUri);
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
    const deck = this.dbState.cards.map((card) => card.record || {});
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: 'application/json' });
    this._triggerDownload(blob, 'deck.json');
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.getCurrentRecord(), null, 2)], { type: 'application/json' });
    this._triggerDownload(blob, 'card-data.json');
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
        const record = JSON.parse(raw);
        if (!this.isValidRecord(record)) {
          alert('Error: JSON data must include at least one of these fields: "card-name", "scientific-name", "fact", "abilities", "attack", "health", "flora", "water", or "fauna", and only known card data keys.');
          return;
        }
        this.applyRecord(record);
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
    if ('artworkDataUri' in record) {
      const uri = record.artworkDataUri;
      if (uri !== '' && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(uri)) return false;
    }
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