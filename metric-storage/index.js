const os = require('os');
const { exec: e } = require('child_process');
const util = require('util');
const cron = require('node-cron');

const exec = util.promisify(e);

if (process.env.NRIA_LICENSE_KEY === 'DUMMY') {
  console.log('NRIA_LICENSE_KEY must change');
  return;
}

/* ssacli */
const parseNumberIfPossible = (value/*: string*/)/*: string | number */ => {
  const t = Number(value);
  if (isNaN(t)) return value;
  return t;
}

const convertToObject = (stdout, offsetLine) => {
  const lines = stdout.split('\n').filter((str) => str.trim().length > 0).slice(offsetLine);
  if (lines.length === 0) {
    return [];
  }
  const indexPadding = lines[0].length - lines[0].trimLeft().length;
  const result = [];
  lines.forEach((rawLine) => {
    const line = rawLine.slice(indexPadding);
    if (line.length === 0) {
      return;
    }
    if (line[0] !== ' ') {
      result.push({ name: line });
    } else if (result.length > 0) {
      const e = line.split(': ');
      result[result.length - 1][e[0].trim()] = parseNumberIfPossible(e[1]);
    }
  });

  return result;
};

const getControllers = async () => {
  const controllerResult = await exec('ssacli ctrl all show detail');
  return convertToObject(controllerResult.stdout, 0);
};

const getArrays = async (controllerSlot) => {
  const arrayResult = await exec(`ssacli ctrl slot=${controllerSlot} array all show detail`);
  return convertToObject(arrayResult.stdout, 1);
};

/**
 * { controllerSlot, arrays: { A: { convertedJSON } } }
 */
const getPhysicalDrives = async (controllerSlot) => {
  const pdResult = await exec(`ssacli ctrl slot=${controllerSlot} pd all show detail`);
  const lines = pdResult.stdout.split('\n').filter((str) => str.trim().length > 0).slice(1);
  const arrayLabelIndent = lines[0].length - lines[0].trimLeft().length;
  const arraySeparatedLines = [];
  lines.forEach((rawLine) => {
    const line = rawLine.slice(arrayLabelIndent);
    if (line[0] !== ' ') {
      arraySeparatedLines.push([line]);
    } else {
      arraySeparatedLines[arraySeparatedLines.length - 1].push(line);
    }
  });
  const result = { controllerSlot, arrays: {} };
  arraySeparatedLines.forEach((lines) => {
    const splittedArrayLabel = lines.shift().split(" ");
    const arrayLabel = splittedArrayLabel[1] || splittedArrayLabel[0];
    const pdLabelIndent = lines[0].length - lines[0].trimLeft().length;
    result.arrays[arrayLabel] = convertToObject(lines.map((str) => str.slice(pdLabelIndent)).join('\n'));
  });
  return result;
};

const sendMetrics = async (metrics) => fetch(process.env.NEW_RELIC_METRIC_API, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Api-Key': process.env.NRIA_LICENSE_KEY,
  },
  body: JSON.stringify([{ metrics }]),
})/*.then(console.log)*/.catch(console.error);

const statusToInt = (str) => (str === 'OK' ? 0 : 1);

const makeControllerMetrics = async (controllers, timestamp) => controllers.flatMap((controller) => ([
  {
    name: 'host.storage.controller.status',
    type: 'gauge',
    value: statusToInt(controller['Controller Status']),
    timestamp,
    attributes: {
      'host.name': os.hostname(),
      'controller.slot': controller.Slot,
      'controller.serial': controller['Serial Number'],
    },
  },
  {
    name: 'host.storage.controller.temperature',
    type: 'gauge',
    value: controller['Controller Temperature (C)'],
    timestamp,
    attributes: {
      'host.name': os.hostname(),
      'controller.slot': controller.Slot,
      'controller.serial': controller['Serial Number'],
    },
  },
  {
    name: 'host.storage.controller.cacheModule.temperature',
    type: 'gauge',
    value: controller['Cache Module Temperature (C)'],
    timestamp,
    attributes: {
      'host.name': os.hostname(),
      'controller.slot': controller.Slot,
      'controller.serial': controller['Serial Number'],
    },
  },
]));

const makeArrayMetrics = async (controllers, timestamp) => {
  const controllerArrays = await Promise.all(controllers.map(
    (controller) => getArrays(controller.Slot).then((arrays) => ({ controller, arrays })),
  ));

  return controllerArrays.flatMap(({ controller, arrays }) => arrays.flatMap((array) => [
    {
      name: 'host.storage.array.status',
      type: 'gauge',
      value: statusToInt(array.Status),
      timestamp,
      attributes: {
        'host.name': os.hostname(),
        'controller.slot': controller.Slot,
        'controller.serial': controller['Serial Number'],
        'array.label': array.name.substr(7), // 'Arrays: '
      },
    },
    {
      name: 'host.storage.array.multiDomain.status',
      type: 'gauge',
      value: statusToInt(array['MultiDomain Status']),
      timestamp,
      attributes: {
        'host.name': os.hostname(),
        'controller.slot': controller.Slot,
        'controller.serial': controller['Serial Number'],
        'array.label': array.name.substr(7), // ditto
      },
    },
  ]));
};

const makePhysicalDriveMetrics = async (controllers, timestamp) => {
  const controllerDrives = await Promise.all(controllers.map(
    (controller) => getPhysicalDrives(controller.Slot).then(({ arrays }) => ({ controller, arrays })),
  ));

  return controllerDrives.flatMap(({ controller, arrays }) => Object.entries(arrays).flatMap(([arrayLabel, drives]) => drives.flatMap((drive) => [
    {
      name: 'host.storage.physicalDrive.status',
      type: 'gauge',
      value: statusToInt(drive.Status),
      timestamp,
      attributes: {
        'host.name': os.hostname(),
        'controller.slot': controller.Slot,
        'controller.serial': controller['Serial Number'],
        'array.label': arrayLabel,
        'drive.port': drive.Port,
        'drive.box': drive.Box,
        'drive.bay': drive.Bay
      },
    },
    {
      name: 'host.storage.physicalDrive.temperature',
      type: 'gauge',
      value: drive['Current Temperature (C)'],
      timestamp,
      attributes: {
        'host.name': os.hostname(),
        'controller.slot': controller.Slot,
        'controller.serial': controller['Serial Number'],
        'array.label': arrayLabel,
        'drive.port': drive.Port,
        'drive.box': drive.Box,
        'drive.bay': drive.Bay
      },
    },
  ])));
};


cron.schedule(process.env.CRON_TIME, async () => {
  const startTimeMillis = Date.now();
  const controllers = await getControllers();
  const metrics = [
    (await makeControllerMetrics(controllers, startTimeMillis)),
    (await makeArrayMetrics(controllers, startTimeMillis)),
    (await makePhysicalDriveMetrics(controllers, startTimeMillis)),
  ].flat();

  sendMetrics(metrics);
});


