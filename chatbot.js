class SimpleBot {
    constructor() {
        this.brainKey = 'aplus_chat_brain_v1';
        this.knowledge = this.loadBrain();
        this.recognition = null;
        this.synth = window.speechSynthesis;
        this.setupVoice();
        this.startGlobalSync();
    }

    loadBrain() {
        const saved = localStorage.getItem(this.brainKey);
        return saved ? JSON.parse(saved) : [
            { q: "hello", a: "Hello! How can I help you achieve your college goals today?" },
            { q: "hi", a: "Hi there! Welcome to the Digital Hub." },
            { q: "who are you", a: "I am your APlus Assistant, here to help you with our services." },
            { q: "price", a: "Our services start from just ₹49. You can check the services section for details." },
            { q: "fees", a: "Charges depend on the service. Projects start at ₹599, and counselling is just ₹49." },
            { q: "kitna paisa", a: "Rates bohot affordable hain. Resume ₹199 se start hota hai." },
            { q: "services", a: "We offer Placement Counselling, Project Help, Resume Building, Portfolio Websites, and Internship finding." },
            { q: "contact", a: "You can use the 'Request Service' form or call us directly." },
            { q: "placement", a: "We provide personalized placement counselling and resume reviews." }
        ];
    }

    saveBrain() {
        localStorage.setItem(this.brainKey, JSON.stringify(this.knowledge));
    }

    async train(question, answer) {
        // Local update
        const exists = this.knowledge.find(k => k.q.toLowerCase() === question.toLowerCase());
        if (exists) {
            exists.a = answer;
        } else {
            this.knowledge.push({ q: question.toLowerCase(), a: answer });
        }
        this.saveBrain();

        // Global update (Firestore)
        if (window.db) {
            try {
                // We use a simple document 'brain' with a field 'data' array, or a collection 'bot_knowledge'
                // For simplicity, let's use a collection 'bot_knowledge' where doc ID is a hash or just random
                // Actually, to keep it simple, let's just push the specific Q/A as a doc.
                await window.db.collection('bot_knowledge').add({ q: question, a: answer, timestamp: Date.now() });
                console.log("Brain updated globally");
            } catch (e) {
                console.error("Brain sync failed", e);
            }
        }
        return true;
    }

    startGlobalSync() {
        if (!window.db) return;
        window.db.collection('bot_knowledge').orderBy('timestamp').onSnapshot(snap => {
            snap.docChanges().forEach(change => {
                if (change.type === "added") {
                    const data = change.doc.data();
                    // Merge into local knowledge if not present (or update)
                    const mkQ = data.q.toLowerCase();
                    const exists = this.knowledge.find(k => k.q.toLowerCase() === mkQ);
                    if (exists) {
                        exists.a = data.a;
                    } else {
                        this.knowledge.push({ q: mkQ, a: data.a });
                    }
                }
            });
            this.saveBrain(); // Update local storage with new global knowledge
        });
    }

    findAnswer(query) {
        if (!query) return null;
        query = query.toLowerCase();

        // 1. Direct Match
        const exact = this.knowledge.find(k => k.q === query);
        if (exact) return exact.a;

        // 2. Keyword / Fuzzy Match
        // Sort by best overlap
        let bestMatch = null;
        let maxScore = 0;

        this.knowledge.forEach(k => {
            let score = 0;
            const words = k.q.split(" ");
            words.forEach(w => {
                if (query.includes(w)) score++;
            });

            // Simple ratio of matched words to total words in keyword
            const ratio = score / words.length;

            if (score > 0 && ratio > maxScore) {
                maxScore = ratio;
                bestMatch = k;
            }
        });

        if (maxScore > 0.3) { // Threshold
            return bestMatch.a;
        }

        return "I am still learning. Please ask the Admin to teach me about this!";
    }

    setupVoice() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.lang = 'en-US'; // Default queries
            this.recognition.interimResults = false;
        } else {
            console.warn("Speech Recognition not supported in this browser.");
        }
    }

    speak(text) {
        if (this.synth.speaking) this.synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        // utter.lang = 'en-IN'; // Indian English accent preference
        // Select a voice if possible
        const voices = this.synth.getVoices();
        const preferred = voices.find(v => v.lang.includes('IN') || v.name.includes('Google'));
        if (preferred) utter.voice = preferred;

        this.synth.speak(utter);
    }

    listen(onResult) {
        if (!this.recognition) {
            alert("Voice input not supported in this browser.");
            return;
        }
        this.recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            onResult(text);
        };
        this.recognition.onerror = (e) => console.error("Voice Error", e);
        this.recognition.start();
    }
}

// Initialize Global Bot
const bot = new SimpleBot();
