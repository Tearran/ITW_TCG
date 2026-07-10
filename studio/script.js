const CardJsonDatabase = {
  storageKey: 'itw-tcg-card-editor-record-v1',

  load() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  save(record) {
    localStorage.setItem(this.storageKey, JSON.stringify(record));
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
    this.setSvgImageHref(artwork, dataUri || '');
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

  persistRecord() {
    CardJsonDatabase.save(this.getCurrentRecord());
  },

  restoreSavedRecord() {
    const record = CardJsonDatabase.load();
    if (record) this.applyRecord(record);
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(this.getCurrentRecord(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'card-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
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
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'card.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
};

$(document).ready(() => CardEditor.init());