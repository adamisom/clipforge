import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

const TEMP_DIR = path.join(app.getPath('temp'), 'clipforge-recordings')
const MAX_TEMP_SIZE = 5 * 1024 * 1024 * 1024 // 5 GB
const MAX_FILE_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function initTempDir(): Promise<void> {
  await fs.mkdir(TEMP_DIR, { recursive: true })
}

export async function cleanupTempDir(referencedFiles: string[] = []): Promise<void> {
  try {
    const files = await fs.readdir(TEMP_DIR)
    const now = Date.now()

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file)

      if (referencedFiles.includes(filePath)) continue

      const stats = await fs.stat(filePath)

      if (now - stats.mtime.getTime() > MAX_FILE_AGE) {
        await fs.unlink(filePath)
        console.log(`Deleted old temp file: ${file}`)
      }
    }
  } catch (err) {
    console.error('Error cleaning temp dir:', err)
  }
}

export async function checkTempDirSize(): Promise<number> {
  try {
    const files = await fs.readdir(TEMP_DIR)
    let totalSize = 0

    for (const file of files) {
      const stats = await fs.stat(path.join(TEMP_DIR, file))
      totalSize += stats.size
    }

    return totalSize
  } catch (err) {
    console.error('Error checking temp dir size:', err)
    return 0
  }
}

export function getTempRecordingPath(): string {
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
  return path.join(TEMP_DIR, `clipforge-recording-${timestamp}.webm`)
}

export function isTempFile(filePath: string): boolean {
  return filePath.includes('clipforge-recordings')
}

export async function initializeOnAppStart(referencedFiles: string[]): Promise<void> {
  await initTempDir()
  await cleanupTempDir(referencedFiles)

  const size = await checkTempDirSize()
  if (size > MAX_TEMP_SIZE) {
    console.warn(`Temp dir size (${(size / 1024 / 1024 / 1024).toFixed(2)} GB) exceeds limit`)
  }
}

