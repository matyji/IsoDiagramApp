export const transformIconUrls = (icons: any[]) => {
    return icons.map(icon => {
        // 1. Skip if no icon or no id
        if (!icon || !icon.id) return icon;

        const id = String(icon.id);

        // 2. Handle imported user icons (by collection OR by ID prefix OR by file extension)
        const isImageFile = id.match(/\.(png|jpg|jpeg|svg|webp)$/i);
        if (icon.collection === 'imported' || id.startsWith('icon-') || id.startsWith('base64-') || isImageFile) {
            // Keep data URLs and absolute URLs
            if (icon.url && (icon.url.startsWith('data:') || icon.url.startsWith('http'))) {
                return icon;
            }

            // Normalize to /assets/imported/
            const filename = (icon.url || id).split('/').pop();
            return {
                ...icon,
                collection: 'imported',
                url: `/assets/imported/${filename}`
            };
        }

        // 3. Handle base icons (isoflow / everything else)
        // Skip internal system icons (usually starting with underscore or containing 'isoflow-')
        if (id.startsWith('_') || id.includes('isoflow-')) {
            return icon;
        }

        // Extract the core ID (e.g. 'desktop' from 'isoflow:desktop')
        const coreId = id.split(/[:/]/).pop() || id;

        return {
            ...icon,
            url: `/assets/base/${coreId.toLowerCase()}.svg`
        };
    });
};
