export const encodeCursor = (data) => {
    if (!data) return null;

    const payload = JSON.stringify(data);
    return Buffer.from(payload).toString('base64url');
}

export const decodeCursor = (cursorString) => {
    if (!cursorString) return null;

    try {
        const raw = Buffer.from(cursorString, 'base64url').toString('utf8');
        return JSON.parse(raw);
    } catch (error) {
        return null; // invalid or tempered cursor treated as first page;
    }
}

// now this help in Automatically slices the extra row and generates the next cursor
export const formatPaginationResponse = (rows, limit, getCursorProps) => {
    const hasNextPage = rows.length > limit;

    const items = hasNextPage ? rows.slice(0, limit) : rows;

    let nextCursor = null;
    if (hasNextPage && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = encodeCursor(getCursorProps(lastItem))
    }

    return {
        items,
        pagination: {
            limit,
            hasNextPage,
            nextCursor,
        },
    };
}