const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 1. ROPE DATA STRUCTURE (Simplified for JS)
// ==========================================
// A full immutable Rope is complex; this is a leaf-based simulation 
// optimized for the project requirements to demonstrate splitting/joining.

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

    // Re-calculates weight based on children
    _updateWeight(node) {
        if (node) {
            node.weight = node.left ? node.left.weight + (node.left.right ? node.left.right.weight : 0) : (node.value ? node.value.length : 0);
        }
    }

    // Convert Rope to String (In-order traversal)
    toString(node = this.root) {
        if (!node) return "";
        if (!node.left && !node.right) return node.value;
        return this.toString(node.left) + this.toString(node.right);
    }

    // Basic insert logic (For demo purposes, we regenerate the tree or append)
    // Real-world ropes split nodes. We simply model the logic here.
    insert(index, text) {
        const currentText = this.toString();
        const newText = currentText.slice(0, index) + text + currentText.slice(index);
        this.root = new RopeNode(newText); // Rebuild for simplicity in JS demo
        return newText;
    }

    delete(start, end) {
        const currentText = this.toString();
        const newText = currentText.slice(0, start) + currentText.slice(end);
        this.root = new RopeNode(newText);
        return newText;
    }
}

// ==========================================
// 2. TRIE (Prefix Tree) for Auto-Suggestion
// (Now case-insensitive and with an expanded dictionary)
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
        // Ensure words are stored in lowercase for case-insensitivity
        word = word.toLowerCase();
        let node = this.root;
        for (let char of word) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        node.isEndOfWord = true;
    }

    // Returns words starting with prefix
    find(prefix) {
        // Search in lowercase
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
        // Limit results to a reasonable number to prevent UI overload
        return results.slice(0, 10); 
    }
}

// Initialize Trie with expanded vocabulary
const suggestionTrie = new Trie();
const keywords = [
    // Programming/DS terms
    "function", "return", "const", "let", "var", "import", "export", "class", "console", "log", "async", "await", 
    "structure", "rope", "trie", "stack", "algorithm", "linkedlist", "queue", "heap", "graph", "traverse", "binary",
    // Expanded English Dictionary (Common Words)
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", 
    "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", 
    "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which",
    "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into", "year",
    "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over",
    "think", "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even", "new", 
    "want", "because", "any", "these", "give", "most", "us", "many", "must", "before", "call", "down", "find",
    "better", "editor", "project", "learning", "data", "efficient", "modern", "design", "development", "program",
    "search", "replace", "option", "using", "implement", "create", "application", "text", "file", "tab", "split"
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
            this.redoStack = []; // Clear redo on new change
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
// 4. BOYER-MOORE SEARCH ALGORITHM
// ==========================================
function boyerMooreSearch(text, pattern) {
    const m = pattern.length;
    const n = text.length;
    if (m === 0) return [];

    const badChar = {};

    // Bad Character Heuristic
    for (let i = 0; i < m; i++) {
        badChar[pattern[i]] = i;
    }

    let s = 0; // s is shift of the pattern with respect to text
    const results = [];

    while (s <= (n - m)) {
        let j = m - 1;

        while (j >= 0 && pattern[j] === text[s + j]) {
            j--;
        }

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

// In-memory storage for active sessions
const files = {
    'example.txt': { content: new Rope("Welcome to DS Editor.\nType to start..."), history: new UndoRedoManager() }
};

// GET all files
app.get('/api/files', (req, res) => {
    res.json(Object.keys(files));
});

// GET file content
app.get('/api/file/:name', (req, res) => {
    const name = req.params.name;
    if (files[name]) {
        res.json({ content: files[name].content.toString() });
    } else {
        res.status(404).send("File not found");
    }
});

// CREATE / RENAME File
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

// DELETE File
app.delete('/api/file/:name', (req, res) => {
    delete files[req.params.name];
    res.json({ success: true });
});

// UPDATE File (Rope Operation)
app.post('/api/file/:name/update', (req, res) => {
    const { name } = req.params;
    const { text } = req.body;
    
    if (!files[name]) return res.status(404).send("File not found");

    // 1. Push current state to Undo Stack before updating
    const currentStr = files[name].content.toString();
    files[name].history.saveState(currentStr);

    // 2. Update Rope
    files[name].content = new Rope(text);
    
    // 3. Add words to Trie for future suggestions (case-insensitive)
    text.split(/[\s\n\.\,\!\?]+/).forEach(w => {
        if (w.length > 2) suggestionTrie.insert(w.toLowerCase());
    });

    res.json({ success: true });
});

// UNDO
app.post('/api/file/:name/undo', (req, res) => {
    const { name } = req.params;
    if (!files[name]) return res.status(404).send("Err");
    
    const currentStr = files[name].content.toString();
    const prevStr = files[name].history.undo(currentStr);
    files[name].content = new Rope(prevStr);
    
    res.json({ content: prevStr });
});

// REDO
app.post('/api/file/:name/redo', (req, res) => {
    const { name } = req.params;
    if (!files[name]) return res.status(404).send("Err");
    
    const currentStr = files[name].content.toString();
    const nextStr = files[name].history.redo(currentStr);
    files[name].content = new Rope(nextStr);
    
    res.json({ content: nextStr });
});

// SEARCH (Boyer-Moore)
app.post('/api/search', (req, res) => {
    const { text, pattern } = req.body;
    const indices = boyerMooreSearch(text, pattern);
    res.json({ indices });
});

// AUTOCOMPLETE (Trie)
app.post('/api/autocomplete', (req, res) => {
    const { prefix } = req.body;
    const suggestions = suggestionTrie.find(prefix);
    res.json({ suggestions });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Data Structures Loaded: Rope, Trie, Stacks, Boyer-Moore. Trie initialized with expanded vocabulary.");
});
