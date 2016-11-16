# Installing FOWL
1. Install node.js on your computer
  - On Ubuntu, run `apt-get install nodejs`
  - On other platforms you can download an installer from <https://nodejs.org/en/download/>
2. Download the source code
3. You must create a json configuration files in the same location as the source code
  - `config.json` contains basic information about how to run the program. An example file is:

       <code>{
	"port": "8888",
	"key": "a long random string of (ideally 72) characters"	
}</code>

    - other options are `debug` (`true` for more detailed logging) and `securePort` (to enable HTTPS with a valid certificate)
  
# Running FOWL
1. Run the program using `nodejs index.js`
2. Visit FOWL by directing your browser to `localhost:8888`