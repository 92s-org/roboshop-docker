// every backend call goes through nginx at /api/<service>/...
export class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
    const options = { method, signal, headers: { Accept: 'application/json' } };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let res;
    try {
        res = await fetch(`/api${path}`, options);
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        throw new ApiError(0, 'Network error - is the stack running?');
    }

    const type = res.headers.get('content-type') || '';
    const text = await res.text();
    let data = text;
    if (type.includes('json') && text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!res.ok) {
        // nginx error pages are HTML, show the status line instead
        const message = data?.message
            || (typeof data === 'string' && !type.includes('html') && data)
            || `${res.status} ${res.statusText || 'error'}`;
        throw new ApiError(res.status, message);
    }
    return data;
}

const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
export const money = (n) => euro.format(Number(n) || 0);

export const imageFor = (sku) => `/images/${sku}.png`;
