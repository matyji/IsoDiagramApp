import { useState, useEffect, useCallback, useRef } from 'react';
import { DiagramData } from '../diagramUtils';
import { SavedDiagram } from '../types';
import { storageManager } from '../services/storageService';
import { IconPackName } from '../services/iconPackManager';
import { transformIconUrls } from '../utils/iconUtils';

const DEFAULT_COLORS = [
    { id: 'blue', value: '#0066cc' },
    { id: 'green', value: '#00aa00' },
    { id: 'red', value: '#cc0000' },
    { id: 'orange', value: '#ff9900' },
    { id: 'purple', value: '#9900cc' },
    { id: 'black', value: '#000000' },
    { id: 'gray', value: '#666666' }
];

interface UseDiagramProps {
    coreIcons: any[];
    iconPackManager: any;
    isReadonlyUrl: boolean;
    readonlyDiagramId?: string;
    isEditUrl?: boolean;
    editDiagramId?: string;
}

export const useDiagram = ({
    coreIcons,
    iconPackManager,
    isReadonlyUrl,
    readonlyDiagramId,
    isEditUrl,
    editDiagramId
}: UseDiagramProps) => {
    const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
    const [currentDiagram, setCurrentDiagram] = useState<SavedDiagram | null>(null);
    const [diagramName, setDiagramName] = useState('');
    const [fossflowKey, setFossflowKey] = useState(0);
    const [currentModel, setCurrentModel] = useState<DiagramData | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
    const [serverStorageAvailable, setServerStorageAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Helper to reconstruct icons from item data
    const reconstructIcons = useCallback((items: any[], existingIcons: any[] = [], packIconsOverride?: any[]) => {
        const itemIcons = (items || [])
            .map((item: any) => item.icon)
            .filter((id: string) => id)
            .map((id: string) => {
                // 1. Check if it's a core icon
                const coreMatch = coreIcons.find((ci: any) => ci.id === id || ci.id.split(':').pop() === id);
                if (coreMatch) {
                    return { ...coreMatch, id };
                }

                // 2. Check if it's already in the provided icons (e.g. from data.icons)
                const existingMatch = existingIcons.find(icon => icon.id === id);
                if (existingMatch) return existingMatch;

                // 3. Detect if it's imported (by ID prefix or file extension) or base
                const isImported = id.startsWith('icon-') || id.startsWith('base64-') || id.match(/\.(png|jpg|jpeg|svg|webp)$/i);

                return {
                    id,
                    name: id,
                    // If it's not imported and not core, assume it's in /assets/base/
                    url: isImported ? `/assets/imported/${id}` : `/assets/base/${id.toLowerCase()}.svg`,
                    collection: isImported ? 'imported' : 'base',
                    isIsometric: true
                };
            });

        const importedIconsFromData = (existingIcons || []).filter((icon: any) => icon.collection === 'imported');
        const packIcons = packIconsOverride || iconPackManager.loadedIcons || [];

        const map = new Map();

        // Add pack icons first so they are available
        packIcons.forEach((icon: any) => map.set(icon.id, icon));

        // Add reconstructed/imported icons
        [...itemIcons, ...importedIconsFromData].forEach(icon => {
            if (icon && icon.id) map.set(icon.id, icon);
        });

        const allReconstructed = Array.from(map.values());

        // Final transformation (stripping prefixes, etc.)
        return transformIconUrls(allReconstructed);
    }, [coreIcons, iconPackManager.loadedIcons]);

    const [diagramData, setDiagramData] = useState<DiagramData>(() => {
        const lastOpenedData = localStorage.getItem('fossflow-last-opened-data');
        if (lastOpenedData) {
            try {
                const data = JSON.parse(lastOpenedData);

                // Reconstruction logic for last opened
                const importedIconsFromItems = (data.items || [])
                    .map((item: any) => item.icon)
                    .filter((id: string) => id)
                    .map((id: string) => {
                        const coreMatch = coreIcons.find((ci: any) => ci.id === id || ci.id.split(':').pop() === id);
                        if (coreMatch) return { ...coreMatch, id };

                        return {
                            id,
                            name: id,
                            url: (id.startsWith('icon-') || !id.includes(':')) ? `/assets/imported/${id}` : '',
                            collection: 'imported',
                            isIsometric: true
                        };
                    });

                const importedIconsFromData = (data.icons || []).filter((icon: any) => icon.collection === 'imported');
                const importedMap = new Map();
                [...importedIconsFromItems, ...importedIconsFromData].forEach(icon => importedMap.set(icon.id, icon));

                return {
                    ...data,
                    icons: [...transformIconUrls(coreIcons), ...transformIconUrls(Array.from(importedMap.values()))],
                    colors: data.colors?.length ? data.colors : DEFAULT_COLORS,
                    fitToView: data.fitToView !== false
                };
            } catch (e) {
                console.error('Failed to load last opened data:', e);
            }
        }

        return {
            title: 'Diagramme sans titre',
            icons: transformIconUrls(coreIcons),
            colors: DEFAULT_COLORS,
            items: [],
            views: [],
            fitToView: true
        };
    });

    // Initialize storage
    useEffect(() => {
        storageManager.initialize()
            .then(() => setServerStorageAvailable(storageManager.isServerStorage()))
            .catch(console.error);
    }, []);

    // Load readonly diagram
    useEffect(() => {
        if (!isReadonlyUrl || !serverStorageAvailable || !readonlyDiagramId) return;

        const loadReadonly = async () => {
            try {
                setIsLoading(true);
                const storage = storageManager.getStorage();
                const data = await storage.loadDiagram(readonlyDiagramId);

                if (!data) throw new Error('Diagram not found');

                await iconPackManager.loadPacksForDiagram(data.items || []);
                const mergedIcons = reconstructIcons(data.items, data.icons);

                const readonlyDiagram: SavedDiagram = {
                    id: readonlyDiagramId,
                    name: data.title || 'Mode lecture seule',
                    data: {
                        ...data,
                        title: data.title || 'Mode lecture seule',
                        items: data.items || [],
                        views: data.views || [],
                        icons: mergedIcons,
                        colors: data.colors?.length ? data.colors : DEFAULT_COLORS
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await loadDiagram(readonlyDiagram, true);
            } catch (error) {
                console.error('Failed to load readonly diagram:', error);
                alert('Échec du chargement du diagramme');
                window.location.href = '/';
            } finally {
                setIsLoading(false);
            }
        };
        loadReadonly();
    }, [readonlyDiagramId, serverStorageAvailable, isReadonlyUrl, coreIcons]);

    // Load edit diagram
    useEffect(() => {
        if (!isEditUrl || !serverStorageAvailable || !editDiagramId) return;

        const loadEdit = async () => {
            try {
                setIsLoading(true);
                const storage = storageManager.getStorage();
                const diagramList = await storage.listDiagrams();
                const diagramInfo = diagramList.find(d => d.id === editDiagramId);
                const data = await storage.loadDiagram(editDiagramId);

                if (!data) throw new Error('Diagram not found');

                await iconPackManager.loadPacksForDiagram(data.items || []);
                const mergedIcons = reconstructIcons(data.items, data.icons);

                const editDiagram: SavedDiagram = {
                    id: editDiagramId,
                    name: diagramInfo?.name || data.title || 'Diagramme sans titre',
                    data: {
                        ...data,
                        title: data.title || diagramInfo?.name || 'Diagramme sans titre',
                        items: data.items || [],
                        views: data.views || [],
                        icons: mergedIcons,
                        colors: data.colors?.length ? data.colors : DEFAULT_COLORS
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: diagramInfo?.lastModified.toISOString() || new Date().toISOString()
                };

                await loadDiagram(editDiagram, true);
            } catch (error) {
                console.error('Failed to load edit diagram:', error);
                alert('Échec du chargement du diagramme pour édition');
                window.location.href = '/';
            } finally {
                setIsLoading(false);
            }
        };
        loadEdit();
    }, [editDiagramId, serverStorageAvailable, isEditUrl, coreIcons]);

    // Sync icons
    useEffect(() => {
        if (isLoading) return; // Prevent syncing while a new diagram is loading
        const transformedLoaded = transformIconUrls(iconPackManager.loadedIcons);
        setDiagramData(prev => ({
            ...prev,
            icons: [
                ...transformedLoaded,
                ...transformIconUrls((prev.icons || []).filter(icon => icon.collection === 'imported'))
            ]
        }));
    }, [iconPackManager.loadedIcons, isLoading]);

    const loadDiagram = useCallback(async (diagram: SavedDiagram, skipUnsavedCheck = false) => {
        if (!skipUnsavedCheck && hasUnsavedChanges && !window.confirm('Vous avez des modifications non enregistrées. Continuer le chargement ?')) return;

        setIsLoading(true);

        let loadedData = diagram.data;
        // If it's a server diagram and we only have the shell (no title or empty items), fetch full data
        if (storageManager.isServerStorage() && (!loadedData.title || (loadedData.title === 'Shell' && loadedData.items.length === 0))) {
            try {
                const storage = storageManager.getStorage();
                loadedData = await storage.loadDiagram(diagram.id);
            } catch (e) {
                console.error('Failed to fetch full data for server diagram:', e);
                alert('Erreur lors du chargement des données depuis le serveur.');
                return;
            }
        }

        await iconPackManager.loadPacksForDiagram(loadedData.items || []);
        const mergedIcons = reconstructIcons(loadedData.items, loadedData.icons);
        const dataWithIcons: DiagramData = {
            ...loadedData,
            title: loadedData.title || diagram.name || 'Diagramme sans titre',
            items: loadedData.items || [],
            views: loadedData.views || [],
            icons: mergedIcons,
            colors: loadedData.colors?.length ? loadedData.colors : DEFAULT_COLORS,
            fitToView: loadedData.fitToView !== false
        };

        setCurrentDiagram({
            ...diagram,
            data: dataWithIcons
        });
        setDiagramName(diagram.name);
        setDiagramData(dataWithIcons);
        setCurrentModel(dataWithIcons);
        setFossflowKey(prev => prev + 1);
        setHasUnsavedChanges(false);

        try {
            localStorage.setItem('fossflow-last-opened', diagram.id);
            const lastOpenedClean = { ...dataWithIcons };
            delete (lastOpenedClean as any).icons;
            delete (lastOpenedClean as any).colors;
            localStorage.setItem('fossflow-last-opened-data', JSON.stringify(lastOpenedClean));
        } catch (e) {
            console.error('Failed to save last opened:', e);
        } finally {
            setIsLoading(false);
        }
    }, [hasUnsavedChanges, iconPackManager, coreIcons, serverStorageAvailable]);

    // Unified list loading
    const refreshDiagramList = useCallback(async () => {
        try {
            const storage = storageManager.getStorage();
            const list = await storage.listDiagrams();

            // Map DiagramInfo to SavedDiagram structure
            const mappedList: SavedDiagram[] = list.map(item => ({
                id: item.id,
                name: item.name,
                data: (item as any).data || {
                    title: 'Shell', // Temporary title to pass validation if ever triggered before fetch
                    items: [],
                    icons: [],
                    views: []
                },
                createdAt: (item as any).createdAt || item.lastModified.toISOString(),
                updatedAt: item.lastModified.toISOString()
            }));

            setDiagrams(mappedList);

            const lastOpenedId = localStorage.getItem('fossflow-last-opened');
            // Only auto-load if we are NOT on a specific diagram URL (display or edit)
            if (lastOpenedId && !currentDiagram && !readonlyDiagramId && !editDiagramId) {
                const last = mappedList.find(d => d.id === lastOpenedId);
                if (last) {
                    await loadDiagram(last, true);
                }
            }
        } catch (e) {
            console.error('Failed to load diagram list:', e);
        }
    }, [currentDiagram, loadDiagram]);

    const storageInitialized = useRef(false);

    // Initialize storage and load list
    useEffect(() => {
        if (storageInitialized.current) return;
        storageInitialized.current = true;

        storageManager.initialize()
            .then(() => {
                setServerStorageAvailable(storageManager.isServerStorage());
                refreshDiagramList();
            })
            .catch(console.error);
    }, [refreshDiagramList]);

    // Persist list to local storage only if NOT using server
    useEffect(() => {
        if (serverStorageAvailable) return;

        try {
            const diagramsToStore = diagrams.map(d => ({
                ...d,
                data: { ...d.data, icons: [], colors: [] }
            }));
            localStorage.setItem('fossflow-diagrams', JSON.stringify(diagramsToStore));
        } catch (e) {
            console.error('Failed to save diagrams to local storage:', e);
        }
    }, [diagrams, serverStorageAvailable]);

    const saveDiagram = useCallback(async () => {
        if (!diagramName.trim()) {
            alert('Veuillez entrer un nom pour le diagramme');
            return;
        }

        const storage = storageManager.getStorage();
        const existingDiagram = diagrams.find(d => d.name === diagramName.trim() && d.id !== currentDiagram?.id);

        if (existingDiagram) {
            if (!window.confirm(`Un diagramme nommé "${diagramName}" existe déjà. Cela l'écrasera. Êtes-vous sûr de vouloir continuer ?`)) return;
        }

        // We no longer save full icons and colors arrays in the JSON
        const savedData: any = {
            title: diagramName,
            items: currentModel?.items || diagramData.items || [],
            views: currentModel?.views || diagramData.views || [],
            fitToView: true
        };

        try {
            let finalId = currentDiagram?.id;

            if (finalId) {
                await storage.saveDiagram(finalId, savedData);
            } else {
                finalId = await storage.createDiagram(savedData);
            }

            const newDiagram: SavedDiagram = {
                id: finalId,
                name: diagramName,
                data: savedData,
                createdAt: currentDiagram?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            setDiagrams(prev => {
                if (currentDiagram) {
                    return prev.map(d => d.id === currentDiagram.id ? newDiagram : d);
                } else if (existingDiagram) {
                    return prev.map(d => d.id === existingDiagram.id ? { ...newDiagram, id: existingDiagram.id, createdAt: existingDiagram.createdAt } : d);
                }
                return [...prev, newDiagram];
            });

            setCurrentDiagram(newDiagram);
            setHasUnsavedChanges(false);
            setLastAutoSave(new Date());

            localStorage.setItem('fossflow-last-opened', newDiagram.id);
            localStorage.setItem('fossflow-last-opened-data', JSON.stringify(newDiagram.data));

            console.log(`Saved to ${storageManager.isServerStorage() ? 'server' : 'local storage'}`);
        } catch (e) {
            console.error('Failed to save diagram:', e);
            alert('Échec de la sauvegarde');
        }
    }, [diagramName, diagrams, currentDiagram, currentModel, diagramData]);


    const deleteDiagram = useCallback(async (id: string) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer ce diagramme ?')) {
            try {
                const storage = storageManager.getStorage();
                await storage.deleteDiagram(id);

                setDiagrams(prev => prev.filter(d => d.id !== id));
                if (currentDiagram?.id === id) {
                    setCurrentDiagram(null);
                    setDiagramName('');
                }
            } catch (e) {
                console.error('Failed to delete diagram:', e);
                alert('Échec de la suppression');
            }
        }
    }, [currentDiagram]);

    const newDiagram = useCallback(() => {
        const message = hasUnsavedChanges ? 'Vous avez des modifications non enregistrées. Exportez d\'abord votre diagramme pour l\'enregistrer. Continuer ?' : 'Créer un nouveau diagramme ?';
        if (window.confirm(message)) {
            const emptyDiagram: DiagramData = {
                title: 'Diagramme sans titre',
                icons: iconPackManager.loadedIcons,
                colors: DEFAULT_COLORS,
                items: [],
                views: [],
                fitToView: true
            };
            setCurrentDiagram(null);
            setDiagramName('');
            setDiagramData(emptyDiagram);
            setCurrentModel(emptyDiagram);
            setFossflowKey(prev => prev + 1);
            setHasUnsavedChanges(false);
            localStorage.removeItem('fossflow-last-opened');
            localStorage.removeItem('fossflow-last-opened-data');
        }
    }, [hasUnsavedChanges, iconPackManager.loadedIcons, coreIcons]);

    const handleModelUpdated = useCallback((model: any) => {
        const updatedModel = {
            title: model.title || diagramName || 'Untitled',
            // Preserve current icons/colors if the update doesn't provide them
            icons: (model.icons && model.icons.length > 0) ? model.icons : (currentModel?.icons || diagramData.icons || []),
            colors: (model.colors && model.colors.length > 0) ? model.colors : (currentModel?.colors || diagramData.colors || DEFAULT_COLORS),
            items: model.items || [],
            views: model.views || [],
            fitToView: true
        };

        setCurrentModel(updatedModel);
        setDiagramData(updatedModel);
        if (!isReadonlyUrl) setHasUnsavedChanges(true);
    }, [diagramName, isReadonlyUrl, currentModel, diagramData, DEFAULT_COLORS]);

    const exportDiagram = useCallback(() => {
        const modelToExport = currentModel || diagramData;

        // When exporting, we ALSO remove icons and colors to keep it clean
        const exportData: any = {
            title: diagramName || modelToExport.title || 'Exported Diagram',
            items: modelToExport.items || [],
            views: modelToExport.views || [],
            fitToView: true
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${diagramName || 'diagram'}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setHasUnsavedChanges(false);
    }, [currentModel, diagramData, diagramName]);

    const handleDiagramManagerLoad = useCallback(async (id: string, data: any) => {
        setIsLoading(true);
        let loadedData = data;

        // If server storage and partial data (Shell), fetch full data
        if (serverStorageAvailable && (!loadedData.items || loadedData.items.length === 0 || loadedData.title === 'Shell')) {
            try {
                const storage = storageManager.getStorage();
                const fetched = await storage.loadDiagram(id);
                if (fetched) {
                    loadedData = fetched;
                }
            } catch (e) {
                console.error('Failed to fetch full diagram:', e);
            }
        }

        const currentPackIcons = await iconPackManager.loadPacksForDiagram(loadedData.items || []);

        const finalIcons = reconstructIcons(loadedData.items, loadedData.icons, currentPackIcons);

        const mergedData: DiagramData = {
            ...loadedData,
            title: loadedData.title || loadedData.name || 'Loaded Diagram',
            items: loadedData.items || [],
            views: loadedData.views || [],
            icons: finalIcons,
            colors: loadedData.colors?.length ? loadedData.colors : DEFAULT_COLORS,
            fitToView: loadedData.fitToView !== false
        };

        const newDiagram = {
            id,
            name: data.name || 'Loaded Diagram',
            data: mergedData,
            createdAt: data.created || new Date().toISOString(),
            updatedAt: data.lastModified || new Date().toISOString()
        };

        setDiagramName(newDiagram.name);
        setCurrentDiagram(newDiagram);
        setCurrentModel(mergedData);
        setDiagramData(mergedData);
        setFossflowKey(prev => prev + 1);
        setIsLoading(false);
    }, [iconPackManager, coreIcons, serverStorageAvailable]);

    // Auto-save effect
    useEffect(() => {
        if (!currentModel || !hasUnsavedChanges || !currentDiagram) return;

        const autoSaveTimer = setTimeout(() => {
            const savedData = {
                title: diagramName || currentDiagram.name,
                icons: [], // Removed
                colors: [], // Removed
                items: currentModel.items || [],
                views: currentModel.views || [],
                fitToView: true
            };

            const updatedDiagram: SavedDiagram = {
                ...currentDiagram,
                data: savedData,
                updatedAt: new Date().toISOString()
            };

            setDiagrams(prev => prev.map(d => d.id === currentDiagram.id ? updatedDiagram : d));

            try {
                localStorage.setItem('fossflow-last-opened-data', JSON.stringify(savedData));
                setLastAutoSave(new Date());
                setHasUnsavedChanges(false);
            } catch (e) {
                console.error('Auto-save failed:', e);
            }
        }, 5000);

        return () => clearTimeout(autoSaveTimer);
    }, [currentModel, hasUnsavedChanges, currentDiagram, diagramName]);

    return {
        diagrams,
        currentDiagram,
        diagramName,
        setDiagramName,
        diagramData,
        fossflowKey,
        hasUnsavedChanges,
        lastAutoSave,
        serverStorageAvailable,
        saveDiagram,
        loadDiagram,
        deleteDiagram,
        newDiagram,
        handleModelUpdated,
        exportDiagram,
        handleDiagramManagerLoad,
        currentModel,
        isLoading
    };
};
