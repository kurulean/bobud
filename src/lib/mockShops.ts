import { Shop } from '../types'

// Centered around Irvine, CA — swap for your test location
export const MOCK_SHOPS: Shop[] = [
  {
    id: '1', name: 'Boba Bliss', address: '123 Main St, Irvine CA',
    lat: 33.6846, lng: -117.8265, rating: 4.8, review_count: 132,
    created_at: '2024-01-01',
  },
  {
    id: '2', name: 'Pearl Garden', address: '456 Culver Dr, Irvine CA',
    lat: 33.6700, lng: -117.8500, rating: 4.5, review_count: 87,
    created_at: '2024-01-02',
  },
  {
    id: '3', name: 'Tapioca House', address: '789 Alton Pkwy, Irvine CA',
    lat: 33.6950, lng: -117.8100, rating: 4.2, review_count: 54,
    created_at: '2024-01-03',
  },
  {
    id: '4', name: 'Milk & Tea Co.', address: '321 Barranca Pkwy, Irvine CA',
    lat: 33.7100, lng: -117.7900, rating: 4.6, review_count: 210,
    created_at: '2024-01-04',
  },
  {
    id: '5', name: 'Boba Universe', address: '555 Jamboree Rd, Irvine CA',
    lat: 33.6600, lng: -117.8400, rating: 3.9, review_count: 33,
    created_at: '2024-01-05',
  },
  {
    id: '6', name: 'Cloud Nine Boba', address: '888 Von Karman Ave, Irvine CA',
    lat: 33.6750, lng: -117.8600, rating: 4.7, review_count: 178,
    created_at: '2024-01-06',
  },
  {
    id: '7', name: 'The Bubble Bar', address: '999 Spectrum Center Dr, Irvine CA',
    lat: 33.6530, lng: -117.7450, rating: 4.4, review_count: 99,
    created_at: '2024-01-07',
  },
]
