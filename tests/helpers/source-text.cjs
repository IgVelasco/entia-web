// Source-text assertions compare code with all whitespace removed, so they hold however Prettier lays the code out.
const compact = (text) => text.replace(/\s+/g, '');
const containsCode = (source, snippet) => compact(source).includes(compact(snippet));

module.exports = { containsCode };
