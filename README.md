# Generator of Relief STL Models

This is a Node JavaScript script to generate STL models of relief based on NASA's SRTM files. It takes an SRTM file and a configuration file (with region boundary and some other parameters) as inputs and generates STL model of corresponding region.

## How to Use

1. Download SRTM file for a region you want to render. Note, that you'll need an account in [NASA Earthdata](https://urs.earthdata.nasa.gov/users/new) website. You can use [this website](https://dwtkns.com/srtm30m/) to choose the file you need. You'll download a file with format HGT.
2. Convert downloaded HGT file to GeoTIFF file. For example, you can do it using GDAL utilities: `gdal_translate -of GTiff N42E019.SRTMGL1.hgt.zip n42_e019_1arc_v3.tif`
3. Create a configuration file in JSON format with description of STL file you want to generate (see description below).
4. Install all the Node.js dependencies: `npm i`
5. Run the script and pass the configuration file as the first paramter: `node index.json config.json`. You'll find the generated file(s) with name `res_<X>_<Y>.stl` in the same root folder.

## Configuration File Format

Configuration file is a JSON file with the following keys of the root object:

- `filename`: GeoTIFF filename. Relative to `index.js`.
- `minLat`, `maxLat`, `minLng`, `maxLng`: min and max coordinates of the region you want to generate. Coordinates in WGS84 ("normal" latitute and longitude).
- `heightScale` (optional): scale of height coordinates (Z-axis). Default: 1.0
- `chunksCountX`, `chunksCountY`: number of chunks on X and Y coordinates to split the model into. Default is 1x1 (only one file). These parameters allow to split the region into sub-regions of equal size and generate a separate STL model for each sub-region.

Example of configuration file:

```
{
  "filename": "./data/n43_e018_1arc_v3.tif",
  "minLat": 18.646,
  "maxLat": 18.822,
  "minLng": 43.155,
  "maxLng": 43.315,

  "heightScale": 2.0,
  "chunksCountX": 2,
  "chunksCountY": 2
}
```

## Notes about Generated STL Model

1. The model will contain all the borders (four side borders and bottom border)
2. X and Y coordinates are in meters, origin is in the west-north corner of the region.
3. The basement of the model is below the lowest point of the relief by 10% of the relief height (difference between highest and lowest point). The basement has zero Z coordinate. Unit of Z axis is meters multiplied by `heightScale` parameter from configuration file.
