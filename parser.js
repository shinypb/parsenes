var fs = require('fs');

//  Reference spec at http://fms.komkon.org/EMUL8/NES.html

var MAGIC_HEADER     = "NES\x1a"
var ROM_BANK_SIZE    = 16 * 1024;
var TRAINER_ROM_SIZE = 512;
var VROM_BANK_SIZE   = 8 * 1024;

function readFile(filename) {
  console.log("parsing", filename);

  var fd = fs.openSync(filename, 'r');
  var fileInfo = fs.fstatSync(fd);

  var buffer = new Buffer(fileInfo.size);
  var bytesRead = fs.readSync(
    fd,
    buffer,
    offset = 0,
    fileInfo.size,
    position = 0
  );

  return buffer;
}

function NESFile(filename) {
  this.data = readFile(filename);
  console.log(this.data.toString('utf8', 0, 4));
  console.log(this.data[3]);
  this.getInfo = function() {
    //  Parses data from the header
    if (typeof this.info != 'undefined') {
      return this.info;
    }

    /*
      Byte     Contents
      ---------------------------------------------------------------------------
      0-3      String "NES^Z" used to recognize .NES files.
      4        Number of 16kB ROM banks.
      5        Number of 8kB VROM banks.
      6        bit 0     1 for vertical mirroring, 0 for horizontal mirroring.
               bit 1     1 for battery-backed RAM at $6000-$7FFF.
               bit 2     1 for a 512-byte trainer at $7000-$71FF.
               bit 3     1 for a four-screen VRAM layout.
               bit 4-7   Four lower bits of ROM Mapper Type.
      7        bit 0     1 for VS-System cartridges.
               bit 1-3   Reserved, must be zeroes!
               bit 4-7   Four higher bits of ROM Mapper Type.
      8        Number of 8kB RAM banks. For compatibility with the previous
               versions of the .NES format, assume 1x8kB RAM page when this
               byte is zero.
      9        bit 0     1 for PAL cartridges, otherwise assume NTSC.
               bit 1-7   Reserved, must be zeroes!
      10-15    Reserved, must be zeroes!
      16-...   ROM banks, in ascending order. If a trainer is present, its
               512 bytes precede the ROM bank contents.
      ...-EOF  VROM banks, in ascending order.
      ---------------------------------------------------------------------------

    */

    if (this.data.toString('utf8', 0, 4) != MAGIC_HEADER) {
      throw new Error("That doesn't look like a valid .nes file");
    }

    this.info = {};
    this.info.romBankCount = this.data[4];
    this.info.vRomBankCount = this.data[5];

    //  Lots o' goodies packed into byte 6
    this.info.mirroring = (this.data[6] & 1) ? 'v' : 'h';
    this.info.hasBatteryBackup = !!(this.data[6] & 2)
    this.info.hasTrainer = !!(this.data[6] & 3);
    this.info.fourScreenVRAM = !!(this.data[6] & 4)
    var mapperTypeLowerBits = this.data[6] & 0x0f;

    //  byte 7
    this.info.isVSSystem = !!(this.data[7] & 1);
    if ((this.data[7] & 0x0e) != 0) {
      throw new Error('Reserved bits were set; unknown format');
    }
    var mapperTypeHigherBits = this.data[6] & 0x0f;
    this.info.mapperType = (mapperTypeHigherBits << 4) | mapperTypeLowerBits;

    //  byte 8
    this.info.ramBankCount = Math.min(1, this.data[8]);

    //  byte 9
    this.info.videoMode = (this.data[9] & 1) ? 'pal' : 'ntsc';
    if ((this.data[9] & 0xfe) != 0) {
      throw new Error('Reserved bits were set; unknown format');
    }

    //  bytes 10-15
    if (this.data[10] + this.data[11] + this.data[12] + this.data[13] + this.data[14] + this.data[15] != 0) {
      throw new Error('Reserved bits were set; unknown format');
    }

    //  ROM banks
    var dataStartIndex = 16;
    var trainerRomBankSizeBytes = this.hasTrainer ? TRAINER_ROM_SIZE : 0;
    var romBankSizeBytes = this.info.romBankCount * ROM_BANK_SIZE;
    var vRomBankSizeBytes = this.info.vRomBankCount * VROM_BANK_SIZE;

    var trainerRomBankStart = dataStartIndex;
    var trainerRomBankEnd = trainerRomBankStart + trainerRomBankSizeBytes;

    var romBankStart = trainerRomBankEnd;
    var romBankEnd = romBankStart + romBankSizeBytes;

    var vRomBankStart = romBankEnd;
    var vRomBankEnd = vRomBankStart + vRomBankSizeBytes;

    this.banks = {
      trainer: this.data.slice(trainerRomBankStart, trainerRomBankEnd),
      rom    : this.data.slice(romBankStart, romBankEnd),
      vrom   : this.data.slice(vRomBankStart, vRomBankEnd)
    }

    //  Ensure we consumed all of the data
    if (vRomBankEnd != this.data.length) {
      throw new Error("Left over data (" + this.data.length - dataStartIndex + " bytes left)");
    }


    return this.info;
  };
}

module.exports = {
  NESFile: NESFile
};