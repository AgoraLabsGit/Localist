declare module "ngeohash" {
  function encode(lat: number, lng: number, precision?: number): string;
  function decode(hash: string): { latitude: number; longitude: number };
}
