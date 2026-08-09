// Order Service
// Handles order submission and retrieval using Firebase or localStorage fallback

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
            console.log('Using localStorage for order storage');
        }
    }

    // Submit order to Firebase or localStorage
    async submitOrder(orderData) {
        if (this.useFirebase && this.db) {
            return await this.submitToFirebase(orderData);
        } else {
            return this.submitToLocalStorage(orderData);
        }
    }

    // Submit to Firebase Firestore
    async submitToFirebase(orderData) {
        try {
            const docRef = await this.db.collection('orders').add(orderData);
            console.log('Order submitted to Firebase:', docRef.id);
            return {
                success: true,
                orderId: orderData.orderId,
                firebaseId: docRef.id
            };
        } catch (error) {
            console.error('Firebase submission error:', error);
            // Fallback to localStorage
            return this.submitToLocalStorage(orderData);
        }
    }

    // Submit to localStorage (fallback)
    submitToLocalStorage(orderData) {
        try {
            let orders = [];
            const saved = localStorage.getItem('orders');
            if (saved) {
                orders = JSON.parse(saved);
            }

            orders.push(orderData);
            localStorage.setItem('orders', JSON.stringify(orders));

            console.log('Order saved to localStorage:', orderData.orderId);
            return {
                success: true,
                orderId: orderData.orderId,
                storage: 'localStorage'
            };
        } catch (error) {
            console.error('localStorage error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get order by ID
    async getOrder(orderId) {
        if (this.useFirebase && this.db) {
            return await this.getOrderFromFirebase(orderId);
        } else {
            return this.getOrderFromLocalStorage(orderId);
        }
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
            return this.getOrderFromLocalStorage(orderId);
        }
    }

    getOrderFromLocalStorage(orderId) {
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            return orders.find(o => o.orderId === orderId) || null;
        } catch (error) {
            console.error('localStorage error:', error);
            return null;
        }
    }

    // Get all orders (for admin)
    async getAllOrders(limit = 50) {
        if (this.useFirebase && this.db) {
            return await this.getAllOrdersFromFirebase(limit);
        } else {
            return this.getAllOrdersFromLocalStorage();
        }
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
            console.error('Firebase get all error:', error);
            return this.getAllOrdersFromLocalStorage();
        }
    }

    getAllOrdersFromLocalStorage() {
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            return orders.sort((a, b) => b.timestamp - a.timestamp);
        } catch (error) {
            console.error('localStorage error:', error);
            return [];
        }
    }

    // Update order status
    async updateOrderStatus(orderId, newStatus) {
        if (this.useFirebase && this.db) {
            return await this.updateStatusInFirebase(orderId, newStatus);
        } else {
            return this.updateStatusInLocalStorage(orderId, newStatus);
        }
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
            return this.updateStatusInLocalStorage(orderId, newStatus);
        }
    }

    updateStatusInLocalStorage(orderId, newStatus) {
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const orderIndex = orders.findIndex(o => o.orderId === orderId);

            if (orderIndex === -1) {
                return { success: false, error: 'Order not found' };
            }

            orders[orderIndex].status = newStatus;
            orders[orderIndex].updatedAt = Date.now();

            localStorage.setItem('orders', JSON.stringify(orders));
            return { success: true };
        } catch (error) {
            console.error('localStorage error:', error);
            return { success: false, error: error.message };
        }
    }

    // Listen to real-time updates (Firebase only)
    listenToOrders(callback) {
        if (!this.useFirebase || !this.db) {
            console.warn('Real-time updates only available with Firebase');
            return null;
        }

        try {
            return this.db.collection('orders')
                .orderBy('timestamp', 'desc')
                .onSnapshot(snapshot => {
                    const orders = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    callback(orders);
                });
        } catch (error) {
            console.error('Firebase listener error:', error);
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

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.OrderService = OrderService;
    window.getOrderService = () => ensureOrderService();
}
