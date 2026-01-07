import { useState, useEffect, useCallback, useRef } from 'react';
import { DiagramData } from '../diagramUtils';
import { SavedDiagram } from '../types';
import { storageManager } from '../services/storageService';
import { IconPackName } from '../services/iconPackManager';

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
}

export const useDiagram = ({
    coreIcons,
    iconPackManager,
    isReadonlyUrl,
    readonlyDiagramId
}: UseDiagramProps) => {
    const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
    const [currentDiagram, setCurrentDiagram] = useState<SavedDiagram | null>(null);
    const [diagramName, setDiagramName] = useState('');
    const [fossflowKey, setFossflowKey] = useState(0);
    const [currentModel, setCurrentModel] = useState<DiagramData | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
    const [serverStorageAvailable, setServerStorageAvailable] = useState(false);

    const [diagramData, setDiagramData] = useState<DiagramData>(() => {
        const lastOpenedData = localStorage.getItem('fossflow-last-opened-data');
        if (lastOpenedData) {
            try {
                const data = JSON.parse(lastOpenedData);
                const importedIcons = (data.icons || []).filter((icon: any) => icon.collection === 'imported');
                return {
                    ...data,
                    icons: [...coreIcons, ...importedIcons],
                    colors: data.colors?.length ? data.colors : DEFAULT_COLORS,
                    fitToView: data.fitToView !== false
                };
            } catch (e) {
                console.error('Failed to load last opened data:', e);
            }
        }

        return {
            title: 'Diagramme sans titre',
            icons: coreIcons,
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
                const storage = storageManager.getStorage();
                const diagramList = await storage.listDiagrams();
                const diagramInfo = diagramList.find(d => d.id === readonlyDiagramId);
                const data = await storage.loadDiagram(readonlyDiagramId);

                const readonlyDiagram: SavedDiagram = {
                    id: readonlyDiagramId,
                    name: diagramInfo?.name || data.title || 'Mode lecture seule',
                    data: data,
                    createdAt: new Date().toISOString(),
                    updatedAt: diagramInfo?.lastModified.toISOString() || new Date().toISOString()
                };

                await loadDiagram(readonlyDiagram, true);
            } catch (error) {
                alert('Échec du chargement du diagramme');
                window.location.href = '/';
            }
        };
        loadReadonly();
    }, [readonlyDiagramId, serverStorageAvailable, isReadonlyUrl]);

    // Sync icons
    useEffect(() => {
        setDiagramData(prev => ({
            ...prev,
            icons: [
                ...iconPackManager.loadedIcons,
                ...(prev.icons || []).filter(icon => icon.collection === 'imported')
            ]
        }));
    }, [iconPackManager.loadedIcons]);

    // Load from local storage
    useEffect(() => {
        const saved = localStorage.getItem('fossflow-diagrams');
        if (saved) {
            const parsed = JSON.parse(saved);
            setDiagrams(parsed);

            const lastOpenedId = localStorage.getItem('fossflow-last-opened');
            if (lastOpenedId) {
                const last = parsed.find((d: SavedDiagram) => d.id === lastOpenedId);
                if (last) {
                    setCurrentDiagram(last);
                    setDiagramName(last.name);
                    setCurrentModel(diagramData);
                }
            }
        }
    }, []);

    // Persist to local storage
    useEffect(() => {
        try {
            const diagramsToStore = diagrams.map(d => ({
                ...d,
                data: { ...d.data, icons: [] }
            }));
            localStorage.setItem('fossflow-diagrams', JSON.stringify(diagramsToStore));
        } catch (e) {
            console.error('Failed to save diagrams:', e);
        }
    }, [diagrams]);

    const saveDiagram = useCallback(() => {
        if (!diagramName.trim()) {
            alert('Veuillez entrer un nom pour le diagramme');
            return;
        }

        const existingDiagram = diagrams.find(d => d.name === diagramName.trim() && d.id !== currentDiagram?.id);
        if (existingDiagram) {
            if (!window.confirm(`Un diagramme nommé "${diagramName}" existe déjà dans cette session. Cela l'écrasera. Êtes-vous sûr de vouloir continuer ?`)) return;
        }

        const importedIcons = (currentModel?.icons || diagramData.icons || [])
            .filter(icon => icon.collection === 'imported');

        const savedData: DiagramData = {
            title: diagramName,
            icons: importedIcons,
            colors: currentModel?.colors || diagramData.colors || [],
            items: currentModel?.items || diagramData.items || [],
            views: currentModel?.views || diagramData.views || [],
            fitToView: true
        };

        const newDiagram: SavedDiagram = {
            id: currentDiagram?.id || Date.now().toString(),
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

        try {
            localStorage.setItem('fossflow-last-opened', newDiagram.id);
            localStorage.setItem('fossflow-last-opened-data', JSON.stringify(newDiagram.data));
        } catch (e) {
            console.error('Failed to save diagram:', e);
        }
    }, [diagramName, diagrams, currentDiagram, currentModel, diagramData]);

    const loadDiagram = useCallback(async (diagram: SavedDiagram, skipUnsavedCheck = false) => {
        if (!skipUnsavedCheck && hasUnsavedChanges && !window.confirm('Vous avez des modifications non enregistrées. Continuer le chargement ?')) return;

        await iconPackManager.loadPacksForDiagram(diagram.data.items || []);

        const importedIcons = (diagram.data.icons || []).filter((icon: any) => icon.collection === 'imported');
        const mergedIcons = [...iconPackManager.loadedIcons, ...importedIcons];
        const dataWithIcons = { ...diagram.data, icons: mergedIcons };

        setCurrentDiagram(diagram);
        setDiagramName(diagram.name);
        setDiagramData(dataWithIcons);
        setCurrentModel(dataWithIcons);
        setFossflowKey(prev => prev + 1);
        setHasUnsavedChanges(false);

        try {
            localStorage.setItem('fossflow-last-opened', diagram.id);
            localStorage.setItem('fossflow-last-opened-data', JSON.stringify(diagram.data));
        } catch (e) {
            console.error('Failed to save last opened:', e);
        }
    }, [hasUnsavedChanges, iconPackManager]);

    const deleteDiagram = useCallback((id: string) => {
        if (window.confirm('Êtes-vous sûr de vouloir supprimer ce diagramme ?')) {
            setDiagrams(prev => prev.filter(d => d.id !== id));
            if (currentDiagram?.id === id) {
                setCurrentDiagram(null);
                setDiagramName('');
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
    }, [hasUnsavedChanges, iconPackManager.loadedIcons]);

    const handleModelUpdated = useCallback((model: any) => {
        const updatedModel = {
            title: model.title || diagramName || 'Untitled',
            icons: model.icons || [],
            colors: model.colors || DEFAULT_COLORS,
            items: model.items || [],
            views: model.views || [],
            fitToView: true
        };

        setCurrentModel(updatedModel);
        setDiagramData(updatedModel);
        if (!isReadonlyUrl) setHasUnsavedChanges(true);
    }, [diagramName, isReadonlyUrl]);

    const exportDiagram = useCallback(() => {
        const modelToExport = currentModel || diagramData;
        const allModelIcons = modelToExport.icons || [];
        const diagramImportedIcons = (diagramData.icons || []).filter(icon => icon.collection === 'imported');

        const iconMap = new Map();
        allModelIcons.forEach(icon => iconMap.set(icon.id, icon));
        diagramImportedIcons.forEach(icon => {
            if (!iconMap.has(icon.id)) iconMap.set(icon.id, icon);
        });

        const exportData = {
            title: diagramName || modelToExport.title || 'Exported Diagram',
            icons: Array.from(iconMap.values()),
            colors: modelToExport.colors || [],
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
        const loadedIcons = data.icons || [];
        await iconPackManager.loadPacksForDiagram(data.items || []);

        let finalIcons;
        const hasDefaultIcons = loadedIcons.some((icon: any) =>
            ['isoflow', 'aws', 'gcp'].includes(icon.collection)
        );

        if (hasDefaultIcons) {
            finalIcons = loadedIcons;
        } else {
            const importedIcons = loadedIcons.filter((icon: any) => icon.collection === 'imported');
            finalIcons = [...iconPackManager.loadedIcons, ...importedIcons];
        }

        const mergedData: DiagramData = {
            ...data,
            title: data.title || data.name || 'Loaded Diagram',
            icons: finalIcons,
            colors: data.colors?.length ? data.colors : DEFAULT_COLORS,
            fitToView: data.fitToView !== false
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
        setHasUnsavedChanges(false);
        setDiagramData(mergedData);
        setFossflowKey(prev => prev + 1);
    }, [iconPackManager]);

    // Auto-save effect
    useEffect(() => {
        if (!currentModel || !hasUnsavedChanges || !currentDiagram) return;

        const autoSaveTimer = setTimeout(() => {
            const importedIcons = (currentModel?.icons || diagramData.icons || [])
                .filter(icon => icon.collection === 'imported');

            const savedData = {
                title: diagramName || currentDiagram.name,
                icons: importedIcons,
                colors: currentModel.colors || [],
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
    }, [currentModel, hasUnsavedChanges, currentDiagram, diagramName, diagramData.icons]);

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
        currentModel
    };
};
