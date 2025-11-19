const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. ROPE DATA STRUCTURE
// ==========================================
class RopeNode {
    constructor(value) {
        this.value = value;
        this.left = null;
        this.right = null;
        this.weight = value.length;
    }
}

class Rope {
    constructor(str = "") {
        this.root = new RopeNode(str);
    }

    toString(node = this.root) {
        if (!node) return "";
        if (!node.left && !node.right) return node.value;
        return this.toString(node.left) + this.toString(node.right);
    }

    insert(index, text) {
        const currentText = this.toString();
        const newText = currentText.slice(0, index) + text + currentText.slice(index);
        this.root = new RopeNode(newText);
        return newText;
    }
}

// ==========================================
// 2. TRIE (Prefix Tree & Spell Checker)
// ==========================================
class TrieNode {
    constructor() {
        this.children = {};
        this.isEndOfWord = false;
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(word) {
        word = word.toLowerCase();
        let node = this.root;
        for (let char of word) {
            if (!node.children[char]) node.children[char] = new TrieNode();
            node = node.children[char];
        }
        node.isEndOfWord = true;
    }

    find(prefix) {
        prefix = prefix.toLowerCase();
        let node = this.root;
        for (let char of prefix) {
            if (!node.children[char]) return [];
            node = node.children[char];
        }
        return this._findAllWords(node, prefix);
    }

    _findAllWords(node, currentPrefix) {
        let results = [];
        if (node.isEndOfWord) results.push(currentPrefix);
        for (let char in node.children) {
            results = results.concat(this._findAllWords(node.children[char], currentPrefix + char));
        }
        return results.slice(0, 8);
    }

    contains(word) {
        word = word.toLowerCase();
        let node = this.root;
        for (let char of word) {
            if (!node.children[char]) return false;
            node = node.children[char];
        }
        return node.isEndOfWord;
    }
}

const suggestionTrie = new Trie();
// Base Dictionary
const keywords = [
    "function", "return", "const", "let", "var", "import", "export", "class", "console", "log", "async", "await",
    "structure", "rope", "trie", "stack", "algorithm", "linkedlist", "queue", "heap", "graph", "traverse", "binary",
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as",
    "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will",
    "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which",
    "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into", "year",
    "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over",
    "think", "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even", "new",
    "want", "because", "any", "these", "give", "most", "us", "many", "must", "before", "call", "down", "find",
    "better", "editor", "project", "learning", "data", "efficient", "modern", "design", "development", "program",
    "search", "replace", "option", "using", "implement", "create", "application", "text", "file", "tab", "split",
    "hello", "world", "welcome", "demo", "check", "spelling", "error", "correct", "wrong", "right", "code", "web",
    "is", "are", "am", "was", "were", "been", "being"
];
keywords.forEach(word => suggestionTrie.insert(word));

// ==========================================
// 3. STACKS (Undo / Redo)
// ==========================================
class UndoRedoManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = 50;
    }

    saveState(text) {
        // Only push if different from top
        if (this.undoStack.length === 0 || this.undoStack[this.undoStack.length - 1] !== text) {
            this.undoStack.push(text);
            if (this.undoStack.length > this.maxSize) this.undoStack.shift();
            this.redoStack = [];
        }
    }

    undo(currentText) {
        if (this.undoStack.length === 0) return currentText;
        const previous = this.undoStack.pop();
        this.redoStack.push(currentText);
        return previous;
    }

    redo(currentText) {
        if (this.redoStack.length === 0) return currentText;
        const next = this.redoStack.pop();
        this.undoStack.push(currentText);
        return next;
    }
}

// ==========================================
// 4. BOYER-MOORE SEARCH
// ==========================================
function boyerMooreSearch(text, pattern) {
    const m = pattern.length;
    const n = text.length;
    if (m === 0) return [];
    const badChar = {};
    for (let i = 0; i < m; i++) badChar[pattern[i]] = i;
    let s = 0;
    const results = [];
    while (s <= (n - m)) {
        let j = m - 1;
        while (j >= 0 && pattern[j] === text[s + j]) j--;
        if (j < 0) {
            results.push(s);
            s += (s + m < n) ? m - badChar[text[s + m]] || -1 : 1;
        } else {
            s += Math.max(1, j - (badChar[text[s + j]] !== undefined ? badChar[text[s + j]] : -1));
        }
    }
    return results;
}

// ==========================================
// SERVER STATE & ROUTES
// ==========================================
const files = {
    'example.txt': { content: new Rope("Welcome to the Editor.\nStart typing to see the magic."), history: new UndoRedoManager() }
};

app.get('/api/files', (req, res) => res.json(Object.keys(files)));

app.get('/api/file/:name', (req, res) => {
    if (files[req.params.name]) res.json({ content: files[req.params.name].content.toString() });
    else res.status(404).send("File not found");
});

app.post('/api/files', (req, res) => {
    const { name, oldName } = req.body;
    if (oldName && files[oldName]) {
        files[name] = files[oldName];
        delete files[oldName];
    } else {
        files[name] = { content: new Rope(""), history: new UndoRedoManager() };
    }
    res.json({ success: true });
});

app.delete('/api/file/:name', (req, res) => {
    delete files[req.params.name];
    res.json({ success: true });
});

// UPDATE FILE (FIXED FOR UNDO/REDO)
app.post('/api/file/:name/update', (req, res) => {
    const { name } = req.params;
    const { text } = req.body;
    if (!files[name]) return res.status(404).send("Err");

    const currentStr = files[name].content.toString();

    // FIX: Don't save history if content hasn't actually changed.
    // This prevents the 'auto-save' from filling the stack with duplicates.
    if (currentStr !== text) {
        files[name].history.saveState(currentStr);
        files[name].content = new Rope(text);

        // Learning Mechanism
        text.split(/[\s\n\.\,\!\?]+/).forEach(w => {
            if (w.length > 2) suggestionTrie.insert(w.toLowerCase());
        });
    }

    res.json({ success: true });
});

app.post('/api/file/:name/undo', (req, res) => {
    if (!files[req.params.name]) return res.status(404).send("Err");
    const prev = files[req.params.name].history.undo(files[req.params.name].content.toString());
    files[req.params.name].content = new Rope(prev);
    res.json({ content: prev });
});

app.post('/api/file/:name/redo', (req, res) => {
    if (!files[req.params.name]) return res.status(404).send("Err");
    const next = files[req.params.name].history.redo(files[req.params.name].content.toString());
    files[req.params.name].content = new Rope(next);
    res.json({ content: next });
});

app.post('/api/search', (req, res) => {
    res.json({ indices: boyerMooreSearch(req.body.text, req.body.pattern) });
});

app.post('/api/autocomplete', (req, res) => {
    res.json({ suggestions: suggestionTrie.find(req.body.prefix) });
});

app.post('/api/check-spelling', (req, res) => {
    const { text } = req.body;
    // Improved Regex to capture words correctly
    const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
    const wrongWords = [];

    words.forEach(w => {
        if (!suggestionTrie.contains(w)) {
            wrongWords.push(w);
        }
    });

    res.json({ wrongWords: [...new Set(wrongWords)] });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
