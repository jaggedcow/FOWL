# Installing FOWL
1. Install node.js on your computer
  - On Ubuntu, run `apt-get install nodejs`
  - On other platforms you can download an installer from <https://nodejs.org/en/download/>
2. Download the source code
3. You must create two json configuration files in the same location as the source code
  - `config.json` contains basic information about how to run the program. An example file is:

       <code>{
	"port": "8888",
	"key": "a long random string of (ideally 72) characters"	
}</code>

  - `analytics.json` will store anonymized output about how many poeple are visiting the site. It should just include the text `{}` initially and will be updated by FOWL
  
# Running FOWL
1. Run the program using `nodejs index.js`
2. Visit FOWL by directing your browser to <localhost:8888>
