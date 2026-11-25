import { useEffect, useRef, useState } from 'react'
import { initialLibraryAssets } from './library'
import type { LibraryAsset } from './library'

const DATABASE = 'motif-atelier'
const STORE = 'uploaded-assets'
const VERSION = 1

type StoredAsset = Omit<LibraryAsset, 'src' | 'file'> & { file?: File }

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法打开本地素材数据库'))
    request.onblocked = () => reject(new Error('本地素材数据库正被其他页面占用'))
  })
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('本地素材数据库操作失败'))
  })
}

export async function loadStoredAssets(): Promise<LibraryAsset[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE, 'readonly')
    const stored = await requestResult(transaction.objectStore(STORE).getAll() as IDBRequest<StoredAsset[]>)
    return stored.sort((a, b) => b.createdAt - a.createdAt).map((asset) => ({
      ...asset,
      src: asset.file ? URL.createObjectURL(asset.file) : '',
      file: asset.file,
      tags: Array.isArray(asset.tags) ? asset.tags : [],
    }))
  } finally {
    database.close()
  }
}

export async function saveStoredAssets(assets: LibraryAsset[]) {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    store.clear()
    for (const asset of assets) {
      if (asset.origin !== 'upload') continue
      const stored: StoredAsset = {
        id: asset.id, name: asset.name, kind: asset.kind, tags: asset.tags,
        origin: asset.origin, size: asset.size, mime: asset.mime,
        createdAt: asset.createdAt, content: asset.content, file: asset.file,
        sourceUrl: asset.sourceUrl, license: asset.license,
      }
      store.put(stored)
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error || new Error('无法保存本地素材'))
      transaction.onabort = () => reject(transaction.error || new Error('本地素材保存已中止'))
    })
  } finally {
    database.close()
  }
}

export function useLibraryAssets(onError: (message: string) => void) {
  const [assets, setAssets] = useState<LibraryAsset[]>(initialLibraryAssets)
  const [ready, setReady] = useState(false)
  const hydrated = useRef(false)
  const errorRef = useRef(onError)
  useEffect(() => { errorRef.current = onError }, [onError])

  useEffect(() => {
    let active = true
    void loadStoredAssets().then((stored) => {
      if (!active) {
        stored.forEach((asset) => { if (asset.src.startsWith('blob:')) URL.revokeObjectURL(asset.src) })
        return
      }
      setAssets((current) => [...stored, ...current.filter((asset) => asset.origin === 'personal' || !stored.some((item) => item.id === asset.id))])
      hydrated.current = true
      setReady(true)
    }).catch((error: unknown) => {
      if (!active) return
      hydrated.current = true
      setReady(true)
      errorRef.current(`本地素材恢复失败：${error instanceof Error ? error.message : '浏览器存储不可用'}`)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    const timer = window.setTimeout(() => {
      void saveStoredAssets(assets).catch((error: unknown) => {
        errorRef.current(`素材暂未保存：${error instanceof Error ? error.message : '浏览器存储空间不足'}`)
      })
    }, 180)
    return () => window.clearTimeout(timer)
  }, [assets])

  return { assets, setAssets, storageReady: ready }
}
