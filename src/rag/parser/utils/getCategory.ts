import { ICategoryData } from '../../../types/category'
import fetchJsonParamsFromPage from './getJsonParamsFromPage'

export default async function getCategory(url: string) {
  const result = (await fetchJsonParamsFromPage(url, [
    'category',
    'products',
  ])) as ICategoryData
  return result
}
