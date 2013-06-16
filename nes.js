var parser = require('./parser');

var nesFile = new parser.NESFile("smb3.nes");
console.log(nesFile.getInfo());