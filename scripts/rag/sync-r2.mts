/**
 * Синхронизирует папку со сгенерированными файлами товаров в R2 для использования в RAG
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// --- CONFIGURATION START ---
const R2_ACCOUNT_ID = 'd0c578de9055091ee5b9e082e9f4ea02'
const R2_ACCESS_KEY_ID = '56c116d064ff7b3a08bdcf2046185739'
const R2_SECRET_ACCESS_KEY = '3bfb8dc96d9b446d25048e3a99bfdbeed76f395747d248134ea729ca99b8cda9'
const R2_BUCKET_NAME = 'syberian-wellness-products'
// --- CONFIGURATION END ---

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Путь к rclone.exe относительно этого скрипта
const RCLONE_PATH = path.resolve(__dirname, '../utils/rclone.exe')

async function main() {
  // Получаем путь к папке из аргументов командной строки
  const targetDir = 'rag/r2-products'

  const absoluteTargetDir = path.resolve(process.cwd(), targetDir)

  if (!fs.existsSync(absoluteTargetDir)) {
    console.error(`❌ Ошибка: Папка не существует: ${absoluteTargetDir}`)
    process.exit(1)
  }

  if (!fs.existsSync(RCLONE_PATH)) {
    console.error(`❌ Ошибка: rclone не найден по пути: ${RCLONE_PATH}`)
    process.exit(1)
  }

  console.log(`🚀 Начинаем синхронизацию папки: ${absoluteTargetDir}`)
  console.log(`📦 R2 Bucket: ${R2_BUCKET_NAME}`)

  // Название ремута для rclone (используется внутри процесса)
  const REMOTE_NAME = 'r2_remote'

  // Передаем конфигурацию через переменные окружения, чтобы не создавать конфиг файл
  const env = {
    ...process.env,
    [`RCLONE_CONFIG_${REMOTE_NAME.toUpperCase()}_TYPE`]: 's3',
    [`RCLONE_CONFIG_${REMOTE_NAME.toUpperCase()}_PROVIDER`]: 'Cloudflare',
    [`RCLONE_CONFIG_${REMOTE_NAME.toUpperCase()}_ACCESS_KEY_ID`]:
      R2_ACCESS_KEY_ID,
    [`RCLONE_CONFIG_${REMOTE_NAME.toUpperCase()}_SECRET_ACCESS_KEY`]:
      R2_SECRET_ACCESS_KEY,
    [`RCLONE_CONFIG_${REMOTE_NAME.toUpperCase()}_ENDPOINT`]: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    [`RCLONE_CONFIG_${REMOTE_NAME.toUpperCase()}_ACL`]: 'private',
  }

  const args = [
    'sync',
    absoluteTargetDir,
    `${REMOTE_NAME}:${R2_BUCKET_NAME}`,
    '--progress', // Показывает прогресс бар
    '--transfers',
    '4', // Количество параллельных загрузок
    '--checkers',
    '8',
  ]

  const rcloneProcess = spawn(RCLONE_PATH, args, {
    env,
    stdio: 'inherit', // Вывод прямо в консоль родительского процесса
    shell: true, // Нужно для Windows, чтобы корректно запускать exe
  })

  rcloneProcess.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Синхронизация успешно завершена!')
    } else {
      console.error(`\n❌ Синхронизация завершилась с ошибкой. Код: ${code}`)
      process.exit(code || 1)
    }
  })

  rcloneProcess.on('error', (err) => {
    console.error('\n❌ Ошибка запуска процесса rclone:', err)
    process.exit(1)
  })
}

main().catch((err) => {
  console.error('Непредвиденная ошибка:', err)
  process.exit(1)
})
