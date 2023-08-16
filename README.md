# FarmOS-Asset-link-plugins
Asset-link plugins for farmOS

## Animal
### Harvesting wool
Plugin that lets you record harvested wool.

## Plants
### Harvesting plants
A plugin that lets you choose what unit you want to record the harvest in.

### Plant plants
A modified version of the planting quickform that creates a plant asset and a planting log with the amount of seeds reduced from the seed asset.
It shows up as a option on land and greehouse assets and place the plant in that location. It preload the species from the seed asset and if you create transplanting or harvest log it preloads the date based on the species maturity_days and transplant_days.
Season, seed asset and species are created if you input something that dosen't exist. The notes field is going to be added to the planting log.

Like the quickform in farmos you can choose to directly transplant, then it is going to be transplanted now in the location of the asset you started it from.

## Seeds
### Add seeds to inventory
Depends on the farm_ledger module to register the price and creating a purchase log for the amount of bought seeds.

## Weather
### Observe rainfall
Lets you record rainfall in mm.

