// src/app/core/services/quick-access.service.ts
import { Injectable } from "@angular/core";
import { StorageKeys } from "../../consts/enums/storage-keys.enum";
import { QuickAccessItem } from "../../interfaces/quick-access-list.interface";
import { SessionStorageService } from "./storage/session-storage.service";
import { availableQuickAccess, quickAccessMap } from "../../consts/values/quick-access.consts";
import { BusinessCategoryId } from "../../consts/enums/business/business-category.enum";

interface QuickAccessState {
  custom: QuickAccessItem[]; 
  removed: string[];         
}

@Injectable({ providedIn: "root" })
export class QuickAccessService {
  private readonly STORAGE_KEY = StorageKeys.QUICK_ACCESS;
  private readonly CATALOG: QuickAccessItem[] = availableQuickAccess;

  constructor(private sessionStorage: SessionStorageService) {}


  public getQuickAccesslist(): QuickAccessItem[] {
    return this.CATALOG;
  }


  public getQuickAccessByCategory(categoryId: BusinessCategoryId): QuickAccessItem[] {
    return quickAccessMap[categoryId] || [];
  }


  private readState(): QuickAccessState {
    const raw = this.sessionStorage.getProperty<QuickAccessState | QuickAccessItem[] | null>(this.STORAGE_KEY);

    if (Array.isArray(raw)) {
      return { custom: raw, removed: [] };
    }

    if (raw && typeof raw === "object" && Array.isArray(raw.custom) && Array.isArray(raw.removed)) {
     
      return { custom: [...raw.custom], removed: [...raw.removed] };
    }

    return { custom: [], removed: [] };
    }

  private saveState(state: QuickAccessState): void {
   
    const dedupById = <T extends QuickAccessItem>(arr: T[]) => {
      const seen = new Set<string>();
      return arr.filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
    };

    const cleaned: QuickAccessState = {
      custom: dedupById(state.custom),
      removed: Array.from(new Set(state.removed)),
    };

    this.sessionStorage.setProperty(this.STORAGE_KEY, cleaned);
  }

  public getCustomQuickAccess(): QuickAccessItem[] {
    return this.readState().custom;
  }

 
  public getUserQuickAccess(categoryId: BusinessCategoryId): QuickAccessItem[] {
    const state = this.readState();
    const defaults = this.getQuickAccessByCategory(categoryId)
      .filter(i => !state.removed.includes(i.id));

    const result = [...defaults];
    const ids = new Set(defaults.map(i => i.id));

    for (const c of state.custom) {
      if (!ids.has(c.id)) {
        result.push(c);
        ids.add(c.id);
      }
    }
    return result;
  }

 
  public async addCustomItem(categoryId: BusinessCategoryId, newItem: QuickAccessItem): Promise<boolean> {
    const state = this.readState();

    const exists =
      this.getQuickAccessByCategory(categoryId).some(i => i.id === newItem.id) ||
      state.custom.some(i => i.id === newItem.id);

    if (exists) return false;

    state.custom.push(newItem);
   
    state.removed = state.removed.filter(id => id !== newItem.id);

    this.saveState(state);
    return true;
  }

 
  public async removeItem(categoryId: BusinessCategoryId, itemId: string): Promise<boolean> {
    const state = this.readState();

   
    const before = state.custom.length;
    state.custom = state.custom.filter(i => i.id !== itemId);

    if (state.custom.length < before) {
      this.saveState(state);
      return true;
    }


    const isDefault = this.getQuickAccessByCategory(categoryId).some(i => i.id === itemId);
    if (isDefault) {
      if (!state.removed.includes(itemId)) {
        state.removed.push(itemId);
        this.saveState(state);
      }
      return true;
    }


    return false;
  }

  public async restoreDefaultItem(itemId: string): Promise<boolean> {
    const state = this.readState();
    const len = state.removed.length;
    state.removed = state.removed.filter(id => id !== itemId);
    if (state.removed.length !== len) {
      this.saveState(state);
      return true;
    }
    return false;
  }


  public clearCustomQuickAccess(): void {
    this.saveState({ custom: [], removed: [] });
  }


  public async removeCustomItem(itemId: string): Promise<boolean> {
    const state = this.readState();
    const before = state.custom.length;
    state.custom = state.custom.filter(i => i.id !== itemId);
    this.saveState(state);
    return state.custom.length < before;
  }
}
