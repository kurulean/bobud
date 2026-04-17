export type DrinkTag = 'Milk Tea' | 'Fruit Tea' | 'Matcha' | 'Slush' | 'Classic'

export interface Shop {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  rating: number
  review_count: number
  image_url?: string
  tags: DrinkTag[]
  created_at: string
}

export interface Review {
  id: string
  user_id: string
  shop_id: string
  rating: number
  text?: string
  created_at: string
  profiles?: { username: string }
}

export interface Profile {
  id: string
  username: string
  avatar_url?: string
  created_at: string
}
