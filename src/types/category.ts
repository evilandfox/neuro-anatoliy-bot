export interface ICategoryData {
  category: {
    id: number
    name: string
    url: string
    [k: string]: unknown
  }
  products: {
    id: number
    name: string
    url: string
    [k: string]: unknown
  }[]
}
