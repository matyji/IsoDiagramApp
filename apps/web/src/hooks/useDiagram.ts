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
    const [currentModel, setCurrentModel] = useState<DiagramData | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
    const [serverStorageAvailable, setServerStorageAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [fossflowKey, setFossflowKey] = useState(`initial-${Date.now()}`);
    const loadIdRef = useRef(0);

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
                console.error('Failed to load last opened data, clearing corrupted state:', e);
                localStorage.removeItem('fossflow-last-opened');
                localStorage.removeItem('fossflow-last-opened-data');
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

    const resetToCleanState = useCallback(() => {
        console.warn('[useDiagram] Resetting to clean state due to persistent errors');
        localStorage.removeItem('fossflow-last-opened');
        localStorage.removeItem('fossflow-last-opened-data');

        const emptyDiagram: DiagramData = {
            title: 'Diagramme sans titre',
            icons: transformIconUrls(coreIcons),
            colors: DEFAULT_COLORS,
            items: [],
            views: [],
            fitToView: true
        };

        setCurrentDiagram(null);
        setDiagramName('');
        setDiagramData(emptyDiagram);
        setCurrentModel(emptyDiagram);
        setHasUnsavedChanges(false);
        setFossflowKey(`reset-${Date.now()}`);
    }, [coreIcons]);

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

    // Sync icons from packs when they are loaded/changed
    useEffect(() => {
        if (isLoading) return;

        const transformedLoaded = transformIconUrls(iconPackManager.loadedIcons);
        setDiagramData(prev => {
            // Only update if icons have actually changed to avoid render loops
            const currentImported = (prev.icons || []).filter(icon => icon.collection === 'imported');
            const newIcons = [...transformedLoaded, ...transformIconUrls(currentImported)];

            // Simple check to see if we really need to update
            if (JSON.stringify(newIcons) === JSON.stringify(prev.icons)) return prev;

            return {
                ...prev,
                icons: newIcons
            };
        });
    }, [iconPackManager.loadedIcons, isLoading]);

    const loadDiagram = useCallback(async (diagram: SavedDiagram, skipUnsavedCheck = false) => {
        if (!skipUnsavedCheck && hasUnsavedChanges && !window.confirm('Vous avez des modifications non enregistrées. Continuer le chargement ?')) return;

        const currentLoadId = ++loadIdRef.current;
        setIsLoading(true);

        try {
            console.log(`[useDiagram] Starting load for diagram: ${diagram.id}`);
            let loadedData = diagram.data;

            // 1. Fetch full data if we have a placeholder (Shell)
            const isPlaceholder = !loadedData || !loadedData.views?.length || loadedData.title === 'Shell';
            if (isPlaceholder) {
                console.log(`[useDiagram] Placeholder detected, fetching full data...`);
                const storage = storageManager.getStorage();
                loadedData = await storage.loadDiagram(diagram.id);
            }

            if (currentLoadId !== loadIdRef.current) return;
            if (!loadedData) throw new Error('Données du diagramme introuvables');

            // 2. IMPORTANT: Load required icon packs BEFORE the first render 
            // This avoids the "empty diagram" look and reduces re-renders
            console.log(`[useDiagram] Pre-loading icon packs...`);
            const currentPackIcons = await iconPackManager.loadPacksForDiagram(loadedData.items || []);

            if (currentLoadId !== loadIdRef.current) return;

            // 3. Prepare full data
            const finalIcons = reconstructIcons(loadedData.items, loadedData.icons, currentPackIcons);
            const fullData: DiagramData = {
                ...loadedData,
                title: loadedData.title || diagram.name || 'Diagramme sans titre',
                items: loadedData.items || [],
                views: loadedData.views || [],
                icons: finalIcons,
                colors: loadedData.colors?.length ? loadedData.colors : DEFAULT_COLORS,
                fitToView: loadedData.fitToView !== false
            };

            // 4. Atomic state update
            console.log(`[useDiagram] Applying diagram data and key...`);
            setDiagramName(diagram.name);
            setDiagramData(fullData);
            setCurrentModel(fullData);
            setHasUnsavedChanges(false);
            setCurrentDiagram({ ...diagram, data: fullData });

            // Use a stable key that doesn't change on every micro-update, only on full load
            setFossflowKey(`${diagram.id}-${Date.now()}`);

            localStorage.setItem('fossflow-last-opened', diagram.id);
            const lastOpenedClean = { ...fullData };
            delete (lastOpenedClean as any).icons;
            delete (lastOpenedClean as any).colors;
            localStorage.setItem('fossflow-last-opened-data', JSON.stringify(lastOpenedClean));

            // 5. Success - Unlock with a slight delay to let the new Editor mount settle
            setTimeout(() => {
                if (currentLoadId === loadIdRef.current) {
                    setIsLoading(false);
                    console.log(`[useDiagram] Load complete and UI unlocked.`);
                }
            }, 200);

        } catch (e) {
            if (currentLoadId === loadIdRef.current) {
                console.error('[useDiagram] Failed to load diagram:', e);
                alert(`Erreur lors du chargement : ${e instanceof Error ? e.message : 'Erreur inconnue'}`);
                setIsLoading(false);
            }
        }
    }, [hasUnsavedChanges, iconPackManager, coreIcons, reconstructIcons]);

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
        const message = hasUnsavedChanges ? 'Vous avez des modifications non enregistrées. Créer quand même un nouveau diagramme ?' : 'Créer un nouveau diagramme ?';
        if (window.confirm(message)) {
            // Aggressive clearing: we want to start 100% fresh if they ask for a new diagram
            localStorage.removeItem('fossflow-last-opened');
            localStorage.removeItem('fossflow-last-opened-data');
            localStorage.removeItem('fossflow-last-opened-id'); // Potential other key

            const emptyDiagram: DiagramData = {
                title: 'Diagramme sans titre',
                icons: transformIconUrls(coreIcons),
                colors: DEFAULT_COLORS,
                items: [],
                views: [],
                fitToView: true
            };

            setCurrentDiagram(null);
            setDiagramName('');
            setDiagramData(emptyDiagram);
            setCurrentModel(emptyDiagram);
            setHasUnsavedChanges(false);
            setFossflowKey(`new-${Date.now()}`);
        }
    }, [hasUnsavedChanges, coreIcons]);

    const handleModelUpdated = useCallback((model: any) => {
        // Prevent updates if we are currently loading or starting
        if (isLoading) return;

        // Prevent updates if the incoming model is essentially empty but we have actual data
        // This is the most common cause of "disappearing diagrams" after load
        const hasIncomingData = model.items?.length || model.views?.some((v: any) => v.connectors?.length || v.rectangles?.length || v.textBoxes?.length);
        const hasCurrentData = currentModel?.items?.length || currentModel?.views?.some((v: any) => v.connectors?.length || v.rectangles?.length || v.textBoxes?.length);

        if (!hasIncomingData && hasCurrentData) {
            console.log('[useDiagram] Ignoring empty model update while keeping current data');
            return;
        }

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

        const editDiagram: SavedDiagram = {
            id,
            name: data.name || 'Loaded Diagram',
            data: mergedData,
            createdAt: data.created || new Date().toISOString(),
            updatedAt: data.lastModified || new Date().toISOString()
        };

        // Use the standardized loadDiagram logic to ensure consistency
        await loadDiagram(editDiagram, true);
    }, [loadDiagram]);

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
        resetToCleanState,
        currentModel,
        isLoading
    };
};
