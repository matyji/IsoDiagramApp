export const transformIconUrls = (icons: any[]) => {
    return icons.map(icon => {
        // 1. Skip if no icon or no id
        if (!icon || !icon.id) return icon;

        // 2. Handle regular application icons (isoflow, aws, etc.)
        // We point all non-imported icons to the local /assets/base/ folder
        if (icon.collection !== 'imported') {
            return {
                ...icon,
                url: `/assets/base/${icon.id.toLowerCase()}.svg`
            };
        }

        // 3. Handle imported user icons
        if (icon.collection === 'imported' && icon.url && !icon.url.startsWith('data:')) {
            // If it's already a full URL (including http), keep it
            if (icon.url.startsWith('http')) return icon;

            // If it's already a relative path starting with /assets/download/, keep it
            if (icon.url.startsWith('/assets/download/')) {
                return icon;
            }

            // If it's just a filename or a path, normalize it to /assets/download/
            const filename = icon.url.split('/').pop();
            return {
                ...icon,
                url: `/assets/download/${filename}`
            };
        }

        return icon;
    });
};
