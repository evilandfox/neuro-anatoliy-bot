export interface IProductData {
  id: number
  name: string
  product: {
    id: number
    name: string
    sku: string
    shortDescription: string
    description: string
    howToUse: string
    contraindications: string
    productComponent: string
    categories: { name: string }[]
    [k: string]: unknown
  }
  feedbackList: {
    text: string
    created: string
  }[]
  [k: string]: unknown
}
