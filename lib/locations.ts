export type StoreLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  mapsUrl: string;
};

export const locations: StoreLocation[] = [
  {
    id: "los-angeles",
    name: "Los Angeles",
    address: "3250 W Olympic Blvd #3F, Los Angeles, CA 90006",
    city: "Los Angeles",
    mapsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=3250%20W%20Olympic%20Blvd%20%233F%2C%20Los%20Angeles%2C%20CA%2090006"
  },
  {
    id: "buena-park",
    name: "Buena Park",
    address: "6281 Beach Blvd #106, Buena Park, CA 90621",
    city: "Buena Park",
    mapsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=6281%20Beach%20Blvd%20%23106%2C%20Buena%20Park%2C%20CA%2090621"
  }
];
