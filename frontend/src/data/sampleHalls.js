// Sample data for preview only. Replace with API responses once the backend is connected.
export const SAMPLE_HALLS = [
  {
    id: 'sample-riverside',
    name: 'Riverside Grand Hall',
    location: 'Riverside District',
    capacity: 300,
    priceFrom: null,
    image:
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80',
    description:
      'A spacious pillar-free hall with polished floors and floor-to-ceiling windows overlooking the river.',
    amenities: ['Stage', 'Sound system', 'Bridal room', 'Catering kitchen'],
  },
  {
    id: 'sample-maple',
    name: 'Maple Community Centre',
    location: 'Old Town',
    capacity: 150,
    priceFrom: null,
    image:
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80',
    description:
      'A warm, flexible community space suited to workshops, classes, and neighbourhood gatherings.',
    amenities: ['Projector', 'Whiteboards', 'Kitchenette', 'Parking'],
  },
  {
    id: 'sample-cedar',
    name: 'Cedar Hall & Gardens',
    location: 'Northgate',
    capacity: 500,
    priceFrom: null,
    image:
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1200&q=80',
    description:
      'Indoor hall with an adjoining garden terrace for ceremonies and larger celebrations.',
    amenities: ['Garden terrace', 'Stage', 'Lighting rig', 'Catering kitchen'],
  },
  {
    id: 'sample-harbour',
    name: 'Harbour View Auditorium',
    location: 'Waterfront',
    capacity: 400,
    priceFrom: null,
    image:
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    description:
      'Tiered-seating auditorium designed for performances, lectures, and award ceremonies.',
    amenities: ['Tiered seating', 'AV booth', 'Green room', 'Accessibility access'],
  },
  {
    id: 'sample-orchard',
    name: 'Orchard Banquet Hall',
    location: 'Meadowbrook',
    capacity: 220,
    priceFrom: null,
    image:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
    description:
      'Elegant banquet hall with crystal chandeliers and a dedicated service corridor.',
    amenities: ['Chandeliers', 'Dance floor', 'Bridal suite', 'Valet parking'],
  },
  {
    id: 'sample-foundry',
    name: 'The Foundry Loft',
    location: 'Arts Quarter',
    capacity: 120,
    priceFrom: null,
    image:
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80',
    description:
      'Industrial-chic loft with exposed brick, ideal for launches, exhibitions, and intimate events.',
    amenities: ['Exposed brick', 'Projector', 'Mezzanine', 'Flexible layout'],
  },
]

export const GUEST_OPTIONS = [
  { value: '', label: 'Any size' },
  { value: '50', label: 'Up to 50 guests' },
  { value: '100', label: 'Up to 100 guests' },
  { value: '200', label: 'Up to 200 guests' },
  { value: '300', label: 'Up to 300 guests' },
  { value: '500', label: 'Up to 500 guests' },
]
