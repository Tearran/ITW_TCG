const CardEditor = {
  svgDocument: null,
  svgRoot: null,

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
    });

    $('#artwork-input').on('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      this.updateArtwork(file);
    });

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
      const artwork = this.svgRoot.getElementById('artwork');
      if (!artwork) return;

      artwork.setAttribute('href', dataUri);
      artwork.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUri);

      this.renderPreview();
    };
    reader.readAsDataURL(file);
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