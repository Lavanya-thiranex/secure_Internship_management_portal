const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz-6c9HsOsiQGkM7y5mw8XRhnCDKltpl7RqHHUM1BgUTwNfYfRPFu4t7bm1epbG5D3HCg/exec"; // PASTE YOUR DEPLOYED GAS URL HERE

const DB = {
    data: {
        interns: [],
        domains: {},
        submissions: [],
        settings: {}
    },

    // --- Initialization ---
    async initialize() {
        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("YOUR_WEB_APP_URL")) {
            console.warn("Google Script URL not set. Using local fallback.");
            this.loadLocal();
            return;
        }

        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getAllData`);
            const cloudData = await response.json();

            this.data.interns = cloudData.interns || [];
            this.data.domains = cloudData.domains || this.getDefaultDomains();
            this.data.submissions = cloudData.submissions || [];
            this.data.settings = cloudData.settings || this.getDefaultSettings();

            // Backup to local for offline failsafe
            this.saveLocal();
            console.log("Data synced from Google Sheets");
        } catch (e) {
            console.error("Failed to sync with Google Sheets:", e);
            alert("Network Error: Could not verify data with server. Using last known data.");
            this.loadLocal();
        }
    },

    loadLocal() {
        this.data.interns = JSON.parse(localStorage.getItem('portal_interns')) || [];
        this.data.domains = JSON.parse(localStorage.getItem('portal_domains')) || this.getDefaultDomains();
        this.data.submissions = JSON.parse(localStorage.getItem('portal_submissions')) || [];
        this.data.settings = JSON.parse(localStorage.getItem('portal_settings')) || this.getDefaultSettings();
    },

    saveLocal() {
        localStorage.setItem('portal_interns', JSON.stringify(this.data.interns));
        localStorage.setItem('portal_domains', JSON.stringify(this.data.domains));
        localStorage.setItem('portal_submissions', JSON.stringify(this.data.submissions));
        localStorage.setItem('portal_settings', JSON.stringify(this.data.settings));
    },

    // --- Cloud Sync Helpers ---
    async sync(type) {
        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("YOUR_WEB_APP_URL")) {
            this.saveLocal(); // Just save local if no cloud
            return;
        }

        this.saveLocal(); // Optimistic local save

        const payload = { action: '', [type]: this.data[type] };

        switch (type) {
            case 'interns': payload.action = 'saveInterns'; break;
            case 'domains': payload.action = 'saveDomains'; break;
            case 'submissions': payload.action = 'saveSubmissions'; break;
            case 'settings': payload.action = 'saveSettings'; break;
        }

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Important for GAS
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log(`Synced ${type} to cloud`);
        } catch (e) {
            console.error(`Failed to sync ${type}:`, e);
        }
    },

    // --- Data Accessors (Sync for UI) ---
    get(key) {
        return this.data[key];
    },

    set(key, val) {
        this.data[key] = val;
        this.sync(key);
    },

    // --- Domain Management ---
    getDomains() { return this.data.domains; },

    addDomain(name, tasks) {
        this.data.domains[name] = tasks;
        this.sync('domains');
    },

    updateDomain(oldName, newName, tasks) {
        if (oldName !== newName) {
            delete this.data.domains[oldName];
            // Update interns
            this.data.interns.forEach(i => {
                if (i.domain === oldName) i.domain = newName;
            });
            this.sync('interns');
        }
        this.data.domains[newName] = tasks;
        this.sync('domains');
    },

    deleteDomain(name) {
        delete this.data.domains[name];
        this.sync('domains');
    },

    // --- Intern Management ---
    // Wrappers to ensure we sync 'interns' whenever they change
    updateIntern(id, updates) {
        const idx = this.data.interns.findIndex(i => String(i.id) === String(id));
        if (idx > -1) {
            this.data.interns[idx] = { ...this.data.interns[idx], ...updates };
            this.sync('interns'); // Trigger cloud save

            // Session sync (if self)
            const current = this.getCurrentUser();
            if (current && String(current.id) === String(id)) {
                sessionStorage.setItem('portal_user', JSON.stringify({ ...current, ...this.data.interns[idx] }));
            }
            return true;
        }
        return false;
    },

    // --- Auth ---
    login(email, mobile) {
        if (email === 'admin@thiranex.in' && mobile === 'Thiranex@010525') {
            const admin = { email, role: 'admin', name: 'Admin User' };
            sessionStorage.setItem('portal_user', JSON.stringify(admin));
            return admin;
        }
        const user = this.data.interns.find(i => i.email === email && String(i.mobile) === String(mobile));
        if (user) {
            user.role = 'student';
            sessionStorage.setItem('portal_user', JSON.stringify(user));
            return user;
        }
        return null;
    },
    getCurrentUser() {
        const sessionUser = JSON.parse(sessionStorage.getItem('portal_user'));
        if (!sessionUser) return null;
        if (sessionUser.role === 'admin') return sessionUser;

        // Find fresh data for the student from our synced data
        const freshUser = this.data.interns.find(i => String(i.id) === String(sessionUser.id));
        return freshUser ? { ...freshUser, role: 'student' } : sessionUser;
    },
    logout() {
        sessionStorage.removeItem('portal_user');
        window.location.href = 'index.html';
    },

    // --- Task Engine ---
    getInternTasks(internId, domain) {
        const domainTasks = this.data.domains[domain] || [];
        const mySubs = this.data.submissions.filter(s => String(s.internId) === String(internId));
        const intern = this.data.interns.find(i => String(i.id) === String(internId));

        // Inject Offer Letter Task
        const offerTask = {
            id: 'mandatory_offer_task',
            title: "Offer Letter & LinkedIn Post",
            objective: "Download your offer letter, post it on LinkedIn tagging Thiranex, and share the post URL here.",
            feature: "Download Offer Letter, Post on LinkedIn, Share URL",
            outcome: "Share your success with your network to unlock further internship modules!",
            isMandatory: true // Flag for special UI handling
        };

        const sub = mySubs.find(s => String(s.taskId) === 'mandatory_offer_task');
        const offerTaskWithStatus = {
            ...offerTask,
            status: sub ? sub.status : 'available', // available because it's first
            proof: sub ? sub.proof : '',
            offerLetterUrl: intern ? intern.offerLetterUrl : ''
        };

        const mappedDomainTasks = domainTasks.map(t => {
            const sub = mySubs.find(s => String(s.taskId) === String(t.id));
            return {
                ...t,
                status: sub ? sub.status : 'locked',
                proof: sub ? sub.proof : ''
            };
        });

        return [offerTaskWithStatus, ...mappedDomainTasks];
    },

    submitTask(internId, taskId, proof) {
        const idx = this.data.submissions.findIndex(s => String(s.internId) === String(internId) && String(s.taskId) === String(taskId));
        const newSub = {
            internId: String(internId),
            taskId: String(taskId),
            proof,
            status: 'pending', // Reset to pending if re-submitting
            timestamp: new Date().toISOString()
        };

        if (idx > -1) this.data.submissions[idx] = newSub;
        else this.data.submissions.push(newSub);

        this.sync('submissions');
    },

    approveTask(internId, taskId) {
        const sub = this.data.submissions.find(s => String(s.internId) === String(internId) && String(s.taskId) === String(taskId));
        if (sub) {
            sub.status = 'approved';
            this.sync('submissions');
            return true;
        }
        return false;
    },

    rejectTask(internId, taskId) {
        const sub = this.data.submissions.find(s => String(s.internId) === String(internId) && String(s.taskId) === String(taskId));
        if (sub) {
            sub.status = 'rejected'; // Logic to allow resubmit is handled in UI (locked vs pending vs rejected)
            this.sync('submissions');
            return true;
        }
        return false;
    },

    // --- Payment & Certs ---
    submitPayment(internId, ref) {
        return this.updateIntern(internId, { paymentStatus: 'pending', paymentRef: ref, paymentTimestamp: new Date().toISOString() });
    },
    verifyPayment(internId, status) {
        return this.updateIntern(internId, { paymentStatus: status });
    },
    requestCertificate(internId) {
        return this.updateIntern(internId, { certRequestStatus: 'requested', certRequestDate: new Date().toISOString() });
    },

    // --- Statistics ---
    getInternStats() {
        const activeInterns = this.data.interns.filter(i => i.status !== 'dropped').length; // Original metric
        // Revenue: Calculate from verified payments
        const totalRevenue = this.data.interns
            .filter(i => i.paymentStatus === 'verified')
            .reduce((sum, i) => sum + (parseFloat(i.feeAmount) || 0), 0);

        const amountPending = this.data.interns
            .filter(i => i.paymentStatus === 'pending') // Only pending requests, or all non-verified? "Amount Pending" usually means unpaid outstanding
            .reduce((sum, i) => sum + (parseFloat(i.feeAmount) || 0), 0);

        const pendingCerts = this.data.interns.filter(i => i.certRequestStatus === 'requested').length;

        return { activeInterns, totalRevenue, amountPending, pendingCerts };
    },

    // --- Settings ---
    getSettings() { return this.data.settings; },
    updateSettings(newSettings) {
        this.data.settings = { ...this.data.settings, ...newSettings };
        this.sync('settings');
        return true;
    },

    // --- Defaults ---
    getDefaultDomains() {
        return {
            "Web Development": [
                { id: 1, title: "HTML/CSS Basics", objective: "Build a single page responsive profile using semantic HTML and Vanilla CSS.", feature: "Semantic HTML5 tags, Flexbox/Grid layout, Responsive Media Queries", outcome: "A personal profile page deployed on GitHub Pages." },
                { id: 2, title: "JavaScript Fundamentals", objective: "Create a functional calculator or Todo app using ES6+ features.", feature: "Event listeners, Array methods, LocalStorage", outcome: "A working interactive web application." },
                { id: 3, title: "DOM Manipulation", objective: "Build an interactive image gallery with dynamic filtering.", feature: "Dynamic DOM creation, Filter logic, Modal for image preview", outcome: "An image gallery with category filtering." },
                { id: 4, title: "API Integration", objective: "Fetch and display weather data using a public API (OpenWeather).", feature: "Fetch API / Async-Await, Error handling, JSON parsing", outcome: "A weather dashboard displaying real-time data." },
                { id: 5, title: "Final Project", objective: "A full-fledged portfolio with blog section and contact form.", feature: "Multi-page navigation, Form validation, Responsive design", outcome: "A complete professional portfolio website." }
            ],
            // ... (Other default domains can be added here if needed for fallback)
        };
    },
    getDefaultSettings() {
        return {
            upiId: "thiranex@upi",
            accountName: "Thiranex Edutech",
            bankName: "Indian Bank",
            accountNumber: "50317307045",
            ifsc: "IDIB000P132",
            preferredMethod: "upi"
        };
    }
};
