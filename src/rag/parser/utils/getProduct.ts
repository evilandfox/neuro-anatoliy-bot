import { IProductData } from '../../../types/product'
import fetchJsonParamsFromPage from './getJsonParamsFromPage'

export default async function getProduct(url: string) {
  const result = (await fetchJsonParamsFromPage(url, ['productPage']))
    .productPage as Record<string, unknown>
  const idField = Object.keys(result).find((key) =>
    Number.isInteger(Number(key))
  )!
  const { [idField]: product, ...rest } = result
  return {
    product,
    ...rest,
  } as IProductData
}
