// Order Service
// Handles order submission and retrieval using Firebase (Production Mode)

const ORDER_WRITE_TIMEOUT_MS = 15000;

// Race a promise against a timeout so a hung network call never blocks the UI forever
function withTimeout(promise, ms, message) {
    let timer = null;
    const timeoutPromise = new Promise(function (_, reject) {
        timer = setTimeout(function () {
            reject(new Error(message));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise])
        .finally(function () { clearTimeout(timer); });
}

// Map common Firebase errors to clear, user-facing messages
function getFirebaseErrorMessage(error) {
    if (!error) return 'تعذر حفظ الطلب. يرجى المحاولة مرة أخرى.';
    var code = error.code || '';
    var msg = error.message || '';
    if (code === 'permission-denied') {
        return 'لا توجد صلاحية لحفظ الطلب. تحقق من قواعد Firestore في لوحة التحكم.';
    }
    if (code === 'unavailable' || /network|offline|connection|internet/i.test(msg)) {
        return 'لا يوجد اتصال بالخادم. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.';
    }
    if (code === 'not-found') {
        return 'قاعدة بيانات Firestore غير متوفرة. تأكد من إنشائها في Firebase Console.';
    }
    return msg || 'تعذر حفظ الطلب. يرجى المحاولة مرة أخرى.';
}

// Normalize a timestamp field to epoch milliseconds, whatever its stored type
function orderTimestampMs(order) {
    const ts = order && order.timestamp;
    if (typeof ts === 'number') return ts;
    if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts === 'string') {
        const n = Date.parse(ts);
        return isNaN(n) ? 0 : n;
    }
    return 0;
}

class OrderService {
    constructor() {
        this.useFirebase = false;
        this.db = null;
        this.init();
    }

    init() {
        // Try to initialize Firebase
        if (typeof window.initFirebase === 'function') {
            this.useFirebase = window.initFirebase();
            if (this.useFirebase) {
                this.db = window.getFirestore();
            }
        }

        if (!this.useFirebase) {
            console.error('Firestore not initialized. Orders will fail in Production Mode.');
        }
    }

    // Submit order to Firebase only (Production Mode - no localStorage fallback)
    async submitOrder(orderData) {
        if (!this.useFirebase || !this.db) {
            const error = new Error('Firestore not initialized. Check Firebase config and authentication.');
            console.error('Submit order failed:', error.message);
            return { success: false, error: error.message };
        }
        return await this.submitToFirebase(orderData);
    }

    // Submit to Firebase Firestore
    async submitToFirebase(orderData) {
        // Fail fast when the browser reports being offline
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return { success: false, error: 'لا يوجد اتصال بالإنترنت. تأكد من اتصالك ثم أعد المحاولة.' };
        }

        // Firestore writes can hang indefinitely when the service is unreachable,
        // so race the write against a timeout to never leave the user stuck.
        try {
            const write = this.db.collection('orders').add(orderData);
            const docRef = await withTimeout(
                write,
                ORDER_WRITE_TIMEOUT_MS,
                'انتهت مهلة إرسال الطلب. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.'
            );
            console.log('Order submitted to Firebase:', docRef.id);
            return {
                success: true,
                orderId: orderData.orderId,
                firebaseId: docRef.id
            };
        } catch (error) {
            // Do NOT silently fall back to localStorage here: the caller must be
            // told the order was not persisted to the database, so the customer
            // is never redirected to the confirmation page for an unsaved order.
            console.error('Firebase submission error:', error);
            return {
                success: false,
                error: getFirebaseErrorMessage(error)
            };
        }
    }

    // Get order by ID - Firebase only (Production Mode)
    async getOrder(orderId) {
        if (!this.useFirebase || !this.db) {
            console.error('Firestore not initialized. Cannot retrieve order.');
            return null;
        }
        return await this.getOrderFromFirebase(orderId);
    }

    async getOrderFromFirebase(orderId) {
        try {
            const snapshot = await this.db.collection('orders')
                .where('orderId', '==', orderId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            return snapshot.docs[0].data();
        } catch (error) {
            console.error('Firebase get error:', error);
            throw error; // Production mode: propagate error instead of falling back
        }
    }

    // Get all orders (for admin) - Firebase only (Production Mode)
    async getAllOrders(limit = 50) {
        if (!this.useFirebase || !this.db) {
            console.error('Firestore not initialized. Cannot retrieve orders.');
            return [];
        }
        return await this.getAllOrdersFromFirebase(limit);
    }

    async getAllOrdersFromFirebase(limit) {
        try {
            const snapshot = await this.db.collection('orders')
                .orderBy('timestamp', 'desc')
                .limit(limit)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            // Some collections fail an ordered query (e.g. mixed timestamp types
            // or a missing index). Fall back to an unordered fetch and sort in
            // memory so the admin dashboard still shows the real data.
            if (error && error.code === 'invalid-argument') {
                console.warn('Ordered Firestore query failed, falling back to unordered fetch:', error.message);
                const snapshot = await this.db.collection('orders').limit(limit).get();
                return snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }))
                    .sort((a, b) => orderTimestampMs(b) - orderTimestampMs(a));
            }
            console.error('Firebase getAllOrders error:', error);
            throw error; // Production mode: propagate error
        }
    }

    // Update order status - Firebase only (Production Mode)
    async updateOrderStatus(orderId, newStatus) {
        if (!this.useFirebase || !this.db) {
            console.error('Firestore not initialized. Cannot update order status.');
            return { success: false, error: 'Firestore not initialized' };
        }
        return await this.updateStatusInFirebase(orderId, newStatus);
    }

    async updateStatusInFirebase(orderId, newStatus) {
        try {
            const snapshot = await this.db.collection('orders')
                .where('orderId', '==', orderId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return { success: false, error: 'Order not found' };
            }

            const docId = snapshot.docs[0].id;
            await this.db.collection('orders').doc(docId).update({
                status: newStatus,
                updatedAt: Date.now()
            });

            return { success: true };
        } catch (error) {
            console.error('Firebase update error:', error);
            throw error; // Production mode: propagate error instead of falling back
        }
    }

    // Listen to real-time updates (Firebase only)
    listenToOrders(callback, onError) {
        if (!this.useFirebase || !this.db) {
            console.warn('Real-time updates only available with Firebase');
            return null;
        }

        try {
            return this.db.collection('orders')
                .orderBy('timestamp', 'desc')
                .onSnapshot(
                    snapshot => {
                        const orders = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        callback(orders);
                    },
                    error => {
                        console.error('Firebase listener error:', error);
                        if (typeof onError === 'function') onError(error);
                    }
                );
        } catch (error) {
            console.error('Firebase listener error:', error);
            if (typeof onError === 'function') onError(error);
            return null;
        }
    }
}

// Initialize service
let orderService = null;

function ensureOrderService() {
    if (!orderService) {
        orderService = new OrderService();
    }
    return orderService;
}

document.addEventListener('DOMContentLoaded', () => {
    ensureOrderService();
});

async function createOrder(orderData) {
    const service = ensureOrderService();
    const result = await service.submitOrder(orderData);

    if (!result || !result.success) {
        return {
            success: false,
            error: result && result.error ? result.error : 'Order save failed'
        };
    }

    return result;
}

if (typeof window !== 'undefined') {
    window.createOrder = createOrder;
    window.getOrderService = () => ensureOrderService();
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.OrderService = OrderService;
    window.getOrderService = () => ensureOrderService();

    // Utility exports shared with the admin dashboard (reuse, don't re-declare).
    window.orderTimestampMs = orderTimestampMs;
    window.getFirebaseErrorMessage = getFirebaseErrorMessage;
    window.isPermissionDenied = function isPermissionDenied(error) {
        if (!error) return false;
        return error.code === 'permission-denied' || /permission[-\s]?denied/i.test(error.message || '');
    };

    // Diagnostic helper: run debugFirestore() in the browser console (admin page)
    // to verify Firestore reads work and inspect the stored orders.
    window.debugFirestore = async function debugFirestore() {
        if (typeof firebase === 'undefined') {
            return { error: 'firebase-not-loaded', message: 'Firebase SDK is not loaded on this page.' };
        }
        try {
            const snap = await firebase.firestore().collection('orders').get();
            console.log('[debugFirestore] Document count:', snap.size);
            snap.forEach(doc => {
                const d = doc.data();
                console.log('[debugFirestore]', doc.id, '| orderType:', d.orderType, '| status:', d.status, '| timestamp:', d.timestamp, '(' + (typeof d.timestamp) + ')');
            });
            return snap.size;
        } catch (error) {
            console.error('[debugFirestore] Error:', error.code, error.message);
            return { error: error.code, message: error.message };
        }
    };
}
