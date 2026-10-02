import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

// who is shopping (anonymous id or user name) and their cart
const SessionContext = createContext(null);
const STORAGE_KEY = 'roboshop.session';
export const EMPTY_CART = { total: 0, tax: 0, items: [] };

function loadSession() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? { uniqueid: null, user: null };
    } catch {
        return { uniqueid: null, user: null };
    }
}

export function SessionProvider({ children }) {
    const [session, setSession] = useState(loadSession);
    const [cart, setCart] = useState(EMPTY_CART);
    const [cartLoading, setCartLoading] = useState(true);
    const { uniqueid, user } = session;

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        } catch {
            // storage blocked, the session just won't survive a reload
        }
    }, [session]);

    // anonymous visitors get an id from the user service (Redis INCR)
    useEffect(() => {
        if (uniqueid) return;
        api('/user/uniqueid')
            .then((data) => setSession((s) => ({ ...s, uniqueid: data.uuid })))
            .catch(() => setSession((s) => ({ ...s, uniqueid: `guest-${Date.now()}` })));
    }, [uniqueid]);

    const refreshCart = useCallback(async () => {
        if (!uniqueid) return;
        try {
            setCart(await api(`/cart/cart/${uniqueid}`));
        } catch (err) {
            // 404 just means no cart yet
            if (err.status === 404) setCart(EMPTY_CART);
        } finally {
            setCartLoading(false);
        }
    }, [uniqueid]);

    useEffect(() => {
        refreshCart();
    }, [refreshCart]);

    const addToCart = useCallback(async (sku, qty = 1) => {
        const data = await api(`/cart/add/${uniqueid}/${encodeURIComponent(sku)}/${qty}`, { method: 'POST' });
        setCart(data);
        return data;
    }, [uniqueid]);

    const updateQty = useCallback(async (sku, qty) => {
        const data = await api(`/cart/update/${uniqueid}/${encodeURIComponent(sku)}/${qty}`, { method: 'POST' });
        setCart(data);
        return data;
    }, [uniqueid]);

    // move the anonymous cart over to the user after login/register
    const adoptUser = useCallback(async (newUser) => {
        const oldId = uniqueid;
        if (oldId && oldId !== newUser.name) {
            try {
                await api(`/cart/rename/${oldId}/${encodeURIComponent(newUser.name)}`);
            } catch {
                // 404 is fine, there was no cart to move
            }
        }
        setSession({ uniqueid: newUser.name, user: newUser });
    }, [uniqueid]);

    const login = useCallback(async (name, password) => {
        const data = await api('/user/login', { method: 'POST', body: { name, password } });
        await adoptUser(data);
        return data;
    }, [adoptUser]);

    const register = useCallback(async (name, email, password) => {
        const data = await api('/user/register', { method: 'POST', body: { name, email, password } });
        await adoptUser(data);
        return data;
    }, [adoptUser]);

    const logout = useCallback(() => {
        setCart(EMPTY_CART);
        setSession({ uniqueid: null, user: null });
    }, []);

    const itemCount = cart.items
        .filter((i) => i.sku !== 'SHIP')
        .reduce((sum, i) => sum + i.qty, 0);

    const value = useMemo(() => ({
        uniqueid, user, cart, cartLoading, itemCount,
        setCart, refreshCart, addToCart, updateQty, login, register, logout
    }), [uniqueid, user, cart, cartLoading, itemCount, refreshCart, addToCart, updateQty, login, register, logout]);

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
