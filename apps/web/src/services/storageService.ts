import { Model } from 'fossflow/dist/types';

export interface DiagramInfo {
  id: string;
  name: string;
  lastModified: Date;
  size?: number;
}

export interface StorageService {
  isAvailable(): Promise<boolean>;
  listDiagrams(): Promise<DiagramInfo[]>;
  loadDiagram(id: string): Promise<Model>;
  saveDiagram(id: string, data: Model): Promise<void>;
  deleteDiagram(id: string): Promise<void>;
  createDiagram(data: Model): Promise<string>;
}

// Server Storage Implementation
class ServerStorage implements StorageService {
  private baseUrl: string;
  private available: boolean | null = null;
  private availabilityCheckedAt: number | null = null;
  private readonly AVAILABILITY_CACHE_MS = 60000; // Re-check every 60 seconds

  constructor(baseUrl: string = '') {
    // FORCE relative paths to avoid any "localhost:5000" issues
    // This ensures requests always go to the same origin (port 3001 in Docker)
    this.baseUrl = '';
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  async isAvailable(): Promise<boolean> {
    // Re-check availability if cache is stale
    const now = Date.now();
    if (this.available !== null &&
      this.availabilityCheckedAt !== null &&
      (now - this.availabilityCheckedAt) < this.AVAILABILITY_CACHE_MS) {
      return this.available;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/storage/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      const data = await response.json();
      this.available = data.enabled;
      this.availabilityCheckedAt = Date.now();
      console.log(`Server storage availability: ${this.available}`);
      return this.available ?? false;
    } catch (error) {
      console.log('Server storage not available:', error);
      this.available = false;
      this.availabilityCheckedAt = Date.now();
      return false;
    }
  }

  async listDiagrams(): Promise<DiagramInfo[]> {
    console.log(`Fetching diagrams from: ${this.baseUrl}/api/diagrams`);
    const response = await fetch(`${this.baseUrl}/api/diagrams?t=${Date.now()}`);
    console.log(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to list diagrams:', errorText);
      throw new Error(`Failed to list diagrams: ${response.status} ${errorText}`);
    }

    const diagrams = await response.json();
    console.log(`Received ${diagrams.length} diagrams from server:`, diagrams);

    return diagrams.map((d: any) => ({
      ...d,
      lastModified: new Date(d.lastModified)
    }));
  }

  async loadDiagram(id: string): Promise<Model> {
    console.log(`ServerStorage: Loading diagram ${id} from ${this.baseUrl}/api/diagrams/${id}`);
    try {
      const response = await fetch(`${this.baseUrl}/api/diagrams/${id}?t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ServerStorage: Failed to load diagram ${id}: ${response.status} ${errorText}`);
        throw new Error(`Failed to load diagram: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log(`ServerStorage: Successfully loaded diagram ${id}, items: ${data.items?.length || 0}`);
      return data;
    } catch (error) {
      console.error(`ServerStorage: Error loading diagram ${id}:`, error);
      throw error;
    }
  }

  async saveDiagram(id: string, data: Model): Promise<void> {
    console.log(`ServerStorage: Saving diagram ${id}`);
    try {
      const response = await fetch(`${this.baseUrl}/api/diagrams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000) // 15 second timeout for saves
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ServerStorage: Failed to save diagram ${id}: ${response.status} ${errorText}`);
        throw new Error(`Failed to save diagram: ${response.status}`);
      }

      console.log(`ServerStorage: Successfully saved diagram ${id}`);
    } catch (error) {
      console.error(`ServerStorage: Error saving diagram ${id}:`, error);
      throw error;
    }
  }

  async deleteDiagram(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/diagrams/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete diagram');
  }

  async createDiagram(data: Model): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/diagrams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to create diagram');
    const result = await response.json();
    return result.id;
  }
}

// Local Storage Implementation (renamed from SessionStorage for clarity)
class LocalStorageProvider implements StorageService {
  private readonly KEY_PREFIX = 'fossflow-diagram-';
  private readonly LIST_KEY = 'fossflow-diagrams';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async listDiagrams(): Promise<DiagramInfo[]> {
    const listStr = localStorage.getItem(this.LIST_KEY);
    if (!listStr) return [];

    const list = JSON.parse(listStr);
    return list.map((item: any) => ({
      ...item,
      lastModified: new Date(item.lastModified || item.updatedAt || Date.now())
    }));
  }

  async loadDiagram(id: string): Promise<Model> {
    // Try separate key first
    const data = localStorage.getItem(`${this.KEY_PREFIX}${id}`);
    if (data) return JSON.parse(data);

    // Fallback to searching in the main list (for older data structure)
    const listStr = localStorage.getItem(this.LIST_KEY);
    if (listStr) {
      const list = JSON.parse(listStr);
      const diagram = list.find((d: any) => d.id === id);
      if (diagram && diagram.data) return diagram.data;
    }

    throw new Error('Diagram not found');
  }

  async saveDiagram(id: string, data: Model): Promise<void> {
    localStorage.setItem(`${this.KEY_PREFIX}${id}`, JSON.stringify(data));

    // Update list
    const listStr = localStorage.getItem(this.LIST_KEY);
    const list = listStr ? JSON.parse(listStr) : [];
    const existing = list.findIndex((d: any) => d.id === id);
    const info: DiagramInfo = {
      id,
      name: (data as any).title || (data as any).name || 'Untitled Diagram',
      lastModified: new Date(),
      size: JSON.stringify(data).length
    };

    if (existing >= 0) {
      list[existing] = { ...list[existing], ...info };
    } else {
      list.push(info);
    }

    localStorage.setItem(this.LIST_KEY, JSON.stringify(list));
  }

  async deleteDiagram(id: string): Promise<void> {
    localStorage.removeItem(`${this.KEY_PREFIX}${id}`);

    // Update list
    const listStr = localStorage.getItem(this.LIST_KEY);
    if (listStr) {
      const list = JSON.parse(listStr);
      const filtered = list.filter((d: any) => d.id !== id);
      localStorage.setItem(this.LIST_KEY, JSON.stringify(filtered));
    }
  }

  async createDiagram(data: Model): Promise<string> {
    const id = `diagram_${Date.now()}`;
    await this.saveDiagram(id, data);
    return id;
  }
}

// Storage Manager - decides which storage to use
class StorageManager {
  private serverStorage: ServerStorage;
  private localStorageProvider: LocalStorageProvider;
  private activeStorage: StorageService | null = null;

  constructor() {
    this.serverStorage = new ServerStorage();
    this.localStorageProvider = new LocalStorageProvider();
  }

  async initialize(): Promise<StorageService> {
    // Try server storage first
    if (await this.serverStorage.isAvailable()) {
      console.log('Using server storage');
      this.activeStorage = this.serverStorage;
    } else {
      console.log('Using local storage');
      this.activeStorage = this.localStorageProvider;
    }
    return this.activeStorage;
  }

  getStorage(): StorageService {
    if (!this.activeStorage) {
      throw new Error('Storage not initialized. Call initialize() first.');
    }
    return this.activeStorage;
  }

  isServerStorage(): boolean {
    return this.activeStorage === this.serverStorage;
  }

  getApiUrl(): string {
    return this.serverStorage.getBaseUrl();
  }
}

// Export singleton instance
export const storageManager = new StorageManager();