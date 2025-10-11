import { h } from 'preact';
import htm from 'htm';
const html = htm.bind(h);

let blocklyLoader;

async function ensureBlocklyLoaded() {
  if (!blocklyLoader) {
    blocklyLoader = (async () => {
      const blocklyModule = await import('blockly/core');
      const Blockly = blocklyModule.default || blocklyModule;
      const localeModule = await import('blockly/msg/en');
      const locale = localeModule.default || localeModule;
      Blockly.setLocale(locale);
      await import('blockly/blocks');
      const pythonModule = await import('blockly/python');
      const pythonGenerator = pythonModule.pythonGenerator;

      if (!Blockly.Blocks['pybricks_motor_init']) {
        Blockly.defineBlocksWithJsonArray([
          {
            type: 'pybricks_motor_init',
            message0: 'Motor on %1',
            args0: [
              {
                type: 'input_value',
                name: 'PORT'
              }
            ],
            message1: 'direction %1',
            args1: [
              {
                type: 'field_dropdown',
                name: 'DIRECTION',
                options: [
                  ['⟲', 'Direction.COUNTERCLOCKWISE'],
                  ['⟳', 'Direction.CLOCKWISE']
                ]
              }
            ],
            inputsInline: true,
            output: null,
            colour: 30,
            tooltip: 'Create a Pybricks Motor attached to the selected port.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/motor.html'
          },
          {
            type: 'pybricks_motor_run',
            message0: 'run %1 at speed %2 deg/s',
            args0: [
              {
                type: 'input_value',
                name: 'MOTOR'
              },
              { type: 'input_value', name: 'SPEED', check: 'Number' }
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: 30,
            tooltip: 'Run a Pybricks Motor at the given speed in degrees per second.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/motor.html#pybricks.pupdevices.Motor.run'
          },
          {
            type: 'pybricks_motor_run_time',
            message0: 'run %1 at speed %2 deg/s for %3 seconds wait %4',
            args0: [
              {
                type: 'input_value',
                name: 'MOTOR'
              },
              { type: 'input_value', name: 'SPEED', check: 'Number' },
              { type: 'input_value', name: 'TIME', check: 'Number' },
              {
                type: 'field_dropdown',
                name: 'WAIT',
                options: [
                  ['yes', 'TRUE'],
                  ['no', 'FALSE']
                ]
              }
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: 30,
            tooltip: 'Run a Pybricks Motor at speed for a duration in seconds.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/motor.html#pybricks.pupdevices.Motor.run_time'
          },
          {
            type: 'pybricks_motor_run_angle',
            message0: 'run %1 at speed %2 deg/s for %3 degrees wait %4',
            args0: [
              {
                type: 'input_value',
                name: 'MOTOR'
              },
              { type: 'input_value', name: 'SPEED', check: 'Number' },
              { type: 'input_value', name: 'ANGLE', check: 'Number' },
              {
                type: 'field_dropdown',
                name: 'WAIT',
                options: [
                  ['yes', 'TRUE'],
                  ['no', 'FALSE']
                ]
              }
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: 30,
            tooltip: 'Rotate a Pybricks Motor through a target angle.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/motor.html#pybricks.pupdevices.Motor.run_angle'
          },
          {
            type: 'pybricks_motor_stop',
            message0: 'stop %1',
            args0: [
              {
                type: 'input_value',
                name: 'MOTOR'
              }
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: 30,
            tooltip: 'Stop a Pybricks Motor.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/motor.html#pybricks.pupdevices.Motor.stop'
          },
          {
            type: 'pybricks_port',
            message0: 'Port %1',
            args0: [
              {
                type: 'field_dropdown',
                name: 'PORT',
                options: [
                  ['A', 'Port.A'],
                  ['B', 'Port.B'],
                  ['C', 'Port.C'],
                  ['D', 'Port.D'],
                  ['E', 'Port.E'],
                  ['F', 'Port.F']
                ]
              }
            ],
            output: null,
            colour: 30,
            tooltip: 'Select a Pybricks port.',
            helpUrl: 'https://docs.pybricks.com/en/latest/parameters.html#pybricks.parameters.Port'
          },
          {
            type: 'pybricks_hub_init',
            message0: 'PrimeHub',
            args0: [],
            output: null,
            colour: 200,
            tooltip: 'Create a PrimeHub instance.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html'
          },
          {
            type: 'pybricks_hub_display_text',
            message0: '%1 display text %2',
            args0: [
              { type: 'input_value', name: 'HUB' },
              { type: 'input_value', name: 'TEXT' }
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: 200,
            tooltip: 'Show text on the PrimeHub display.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.PrimeHub.display'
          },
          {
            type: 'pybricks_drivebase_init',
            message0: 'DriveBase',
            message1: '↳ left motor %1',
            message2: '↳ right motor %1',
            message3: '↳ wheel diameter %1',
            message4: '↳ axle track %1',
            args0: [],
            args1: [
              { type: 'input_value', name: 'LEFT' }
            ],
            args2: [
              { type: 'input_value', name: 'RIGHT' }
            ],
            args3: [
              { type: 'input_value', name: 'WHEEL', check: 'Number' }
            ],
            args4: [
              { type: 'input_value', name: 'AXLE', check: 'Number' }
            ],
            output: null,
            colour: 20,
            tooltip: 'Create a DriveBase with two motors and geometry.',
            helpUrl: 'https://docs.pybricks.com/en/latest/robotics/drivebase.html'
          },
          {
            type: 'pybricks_drivebase_straight',
            message0: '%1 drive straight %2 millimeters',
            args0: [
              { type: 'input_value', name: 'DB' },
              { type: 'input_value', name: 'DIST', check: 'Number' }
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: 20,
            tooltip: 'Drive a DriveBase straight for a distance in millimeters.',
            helpUrl: 'https://docs.pybricks.com/en/latest/robotics/drivebase.html#pybricks.robotics.DriveBase.straight'
          },
          {
            type: 'pybricks_drivebase_turn',
            message0: '%1 turn %2 degrees',
            args0: [
              { type: 'input_value', name: 'DB' },
              { type: 'input_value', name: 'ANGLE', check: 'Number' }
            ],
            inputsInline: true,
            previousStatement: null,
            nextStatement: null,
            colour: 20,
            tooltip: 'Turn a DriveBase by a given angle in degrees.',
            helpUrl: 'https://docs.pybricks.com/en/latest/robotics/drivebase.html#pybricks.robotics.DriveBase.turn'
          },
          {
            type: 'pybricks_color_sensor_init',
            message0: 'ColorSensor on %1',
            args0: [
              { type: 'input_value', name: 'PORT' }
            ],
            inputsInline: true,
            output: null,
            colour: 280,
            tooltip: 'Create a ColorSensor on a given port.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/colorsensor.html'
          },
          {
            type: 'pybricks_color_sensor_color',
            message0: '%1 get color',
            args0: [
              { type: 'input_value', name: 'SENSOR' }
            ],
            output: null,
            colour: 280,
            tooltip: 'Read the detected color from a ColorSensor.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/colorsensor.html#pybricks.pupdevices.ColorSensor.color'
          },
          {
            type: 'pybricks_ultrasonic_sensor_init',
            message0: 'UltrasonicSensor on %1',
            args0: [
              { type: 'input_value', name: 'PORT' }
            ],
            inputsInline: true,
            output: null,
            colour: 300,
            tooltip: 'Create an UltrasonicSensor on a given port.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/ultrasonicsensor.html'
          },
          {
            type: 'pybricks_ultrasonic_sensor_distance',
            message0: '%1 distance (mm)',
            args0: [
              { type: 'input_value', name: 'SENSOR' }
            ],
            output: null,
            colour: 300,
            tooltip: 'Measure distance in millimeters using an UltrasonicSensor.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/ultrasonicsensor.html#pybricks.pupdevices.UltrasonicSensor.distance'
          },
          {
            type: 'pybricks_hub_tilt',
            message0: '%1 tilt %2 (degrees)',
            args0: [
              { type: 'input_value', name: 'HUB' },
              {
                type: 'field_dropdown',
                name: 'AXIS',
                options: [
                  ['pitch', 'PITCH'],
                  ['roll', 'ROLL']
                ]
              }
            ],
            output: null,
            colour: 320,
            tooltip: 'Read the pitch or roll from a hub IMU.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.PrimeHub.imu'
          },
          {
            type: 'pybricks_hub_imu_ready',
            message0: '%1 IMU ready?',
            args0: [
              { type: 'input_value', name: 'HUB' }
            ],
            output: 'Boolean',
            colour: 320,
            tooltip: 'Check if the hub IMU is ready.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.PrimeHub.imu'
          },
          {
            type: 'pybricks_hub_imu_stationary',
            message0: '%1 stationary?',
            args0: [
              { type: 'input_value', name: 'HUB' }
            ],
            output: 'Boolean',
            colour: 320,
            tooltip: 'Check if the hub IMU detects no motion.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.PrimeHub.imu'
          },
          {
            type: 'pybricks_hub_imu_up',
            message0: '%1 up',
            args0: [
              { type: 'input_value', name: 'HUB' }
            ],
            output: null,
            colour: 320,
            tooltip: 'Get the side which is up reported by the hub IMU.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.PrimeHub.imu'
          },
          {
            type: 'pybricks_hub_imu_acceleration',
            message0: '%1 acceleration axis %2',
            args0: [
              { type: 'input_value', name: 'HUB' },
              {
                type: 'field_dropdown',
                name: 'AXIS',
                options: [
                  ['X', 'Axis.X'],
                  ['Y', 'Axis.Y'],
                  ['Z', 'Axis.Z']
                ]
              }
            ],
            output: null,
            colour: 320,
            tooltip: 'Get linear acceleration in mm/s² along an axis.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.IMU.acceleration'
          },
          {
            type: 'pybricks_hub_imu_angular_velocity',
            message0: '%1 angular velocity axis %2',
            args0: [
              { type: 'input_value', name: 'HUB' },
              {
                type: 'field_dropdown',
                name: 'AXIS',
                options: [
                  ['X', 'Axis.X'],
                  ['Y', 'Axis.Y'],
                  ['Z', 'Axis.Z']
                ]
              }
            ],
            output: null,
            colour: 320,
            tooltip: 'Get angular velocity in deg/s along an axis.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.IMU.angular_velocity'
          },
          {
            type: 'pybricks_hub_imu_heading',
            message0: '%1 heading',
            args0: [
              { type: 'input_value', name: 'HUB' }
            ],
            output: null,
            colour: 320,
            tooltip: 'Get the current heading in degrees.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.IMU.heading'
          },
          {
            type: 'pybricks_hub_imu_reset_heading',
            message0: '%1 reset heading to %2 deg',
            args0: [
              { type: 'input_value', name: 'HUB' },
              { type: 'input_value', name: 'ANGLE', check: 'Number' }
            ],
            previousStatement: null,
            nextStatement: null,
            colour: 320,
            tooltip: 'Reset the IMU heading to a given angle.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.IMU.reset_heading'
          },
          {
            type: 'pybricks_hub_imu_rotation',
            message0: '%1 rotation axis %2 (deg)',
            args0: [
              { type: 'input_value', name: 'HUB' },
              {
                type: 'field_dropdown',
                name: 'AXIS',
                options: [
                  ['X', 'Axis.X'],
                  ['Y', 'Axis.Y'],
                  ['Z', 'Axis.Z']
                ]
              }
            ],
            output: null,
            colour: 320,
            tooltip: 'Get the rotation angle around an axis.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.IMU.rotation'
          },
          {
            type: 'pybricks_hub_imu_orientation',
            message0: '%1 orientation matrix',
            args0: [
              { type: 'input_value', name: 'HUB' }
            ],
            output: null,
            colour: 320,
            tooltip: 'Get the orientation matrix from the IMU.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#pybricks.hubs.IMU.orientation'
          },
          {
            type: 'pybricks_touch_sensor_init',
            message0: 'TouchSensor on %1',
            args0: [
              { type: 'input_value', name: 'PORT' }
            ],
            inputsInline: true,
            output: null,
            colour: 340,
            tooltip: 'Create a TouchSensor on a given port.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/touchsensor.html'
          },
          {
            type: 'pybricks_touch_sensor_pressed',
            message0: '%1 pressed?',
            args0: [
              { type: 'input_value', name: 'SENSOR' }
            ],
            output: null,
            colour: 340,
            tooltip: 'Check if the TouchSensor is pressed.',
            helpUrl: 'https://docs.pybricks.com/en/latest/pupdevices/touchsensor.html#pybricks.pupdevices.TouchSensor.pressed'
          }
        ]);
      }

      pythonGenerator.forBlock['say_hello'] = function(block, generator) {
        const name = generator.valueToCode(block, 'NAME', pythonGenerator.ORDER_NONE) || '"world"';
        const code = `print("Hello, " + str(${name}))\n`;
        return code;
      };

      function ensureMotorImports(needsPort = false, needsDirection = false) {
        pythonGenerator.definitions_ = pythonGenerator.definitions_ || {};
        pythonGenerator.definitions_['import_pybricks_motor'] = 'from pybricks.pupdevices import Motor';
        if (needsPort) {
          pythonGenerator.definitions_['import_pybricks_port'] = 'from pybricks.parameters import Port';
        }
        if (needsDirection) {
          pythonGenerator.definitions_['import_pybricks_direction'] = 'from pybricks.parameters import Direction';
        }
      }

      function ensureAxisImport() {
        pythonGenerator.definitions_ = pythonGenerator.definitions_ || {};
        pythonGenerator.definitions_['import_pybricks_axis'] = 'from pybricks.parameters import Axis';
      }

      function getMotorCode(block, generator) {
        const code = generator.valueToCode(block, 'MOTOR', pythonGenerator.ORDER_NONE);
        return (code && code.trim()) || 'motor';
      }

      function getPortCode(block, generator) {
        const code = generator.valueToCode(block, 'PORT', pythonGenerator.ORDER_NONE);
        return (code && code.trim()) || 'Port.A';
      }

      function getDirectionCode(block) {
        const value = block.getFieldValue('DIRECTION');
        return value || 'Direction.COUNTERCLOCKWISE';
      }

      pythonGenerator.forBlock['pybricks_motor_init'] = function(block, generator) {
        ensureMotorImports(true, true);
        const port = getPortCode(block, generator);
        const direction = getDirectionCode(block);
        const code = `Motor(${port}, positive_direction=${direction})`;
        return [code, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_motor_run'] = function(block, generator) {
        ensureMotorImports();
        const motorVar = getMotorCode(block, generator);
        const speed = generator.valueToCode(block, 'SPEED', pythonGenerator.ORDER_NONE) || '0';
        return `${motorVar}.run(${speed})\n`;
      };

      pythonGenerator.forBlock['pybricks_motor_run_time'] = function(block, generator) {
        ensureMotorImports();
        const motorVar = getMotorCode(block, generator);
        const speed = generator.valueToCode(block, 'SPEED', pythonGenerator.ORDER_NONE) || '0';
        const duration = generator.valueToCode(block, 'TIME', pythonGenerator.ORDER_NONE) || '0';
        const wait = block.getFieldValue('WAIT') === 'TRUE' ? 'True' : 'False';
        const timeExpr = `(${duration}) * 1000`;
        return `${motorVar}.run_time(${speed}, ${timeExpr}, wait=${wait})\n`;
      };

      pythonGenerator.forBlock['pybricks_motor_run_angle'] = function(block, generator) {
        ensureMotorImports();
        const motorVar = getMotorCode(block, generator);
        const speed = generator.valueToCode(block, 'SPEED', pythonGenerator.ORDER_NONE) || '0';
        const angle = generator.valueToCode(block, 'ANGLE', pythonGenerator.ORDER_NONE) || '0';
        const wait = block.getFieldValue('WAIT') === 'TRUE' ? 'True' : 'False';
        return `${motorVar}.run_angle(${speed}, ${angle}, wait=${wait})\n`;
      };

      pythonGenerator.forBlock['pybricks_motor_stop'] = function(block, generator) {
        ensureMotorImports();
        const motorVar = getMotorCode(block, generator);
        return `${motorVar}.stop()\n`;
      };

      function ensureHubImport() {
        pythonGenerator.definitions_ = pythonGenerator.definitions_ || {};
        pythonGenerator.definitions_['import_pybricks_hub'] = 'from pybricks.hubs import PrimeHub';
      }

      function ensureDriveBaseImport() {
        pythonGenerator.definitions_ = pythonGenerator.definitions_ || {};
        pythonGenerator.definitions_['import_pybricks_drivebase'] = 'from pybricks.robotics import DriveBase';
      }

      function ensurePortImport() {
        pythonGenerator.definitions_ = pythonGenerator.definitions_ || {};
        pythonGenerator.definitions_['import_pybricks_port'] = 'from pybricks.parameters import Port';
      }

      pythonGenerator.forBlock['pybricks_port'] = function(block) {
        ensurePortImport();
        const port = block.getFieldValue('PORT') || 'Port.A';
        return [port, pythonGenerator.ORDER_ATOMIC];
      };

      pythonGenerator.forBlock['pybricks_hub_init'] = function(block, generator) {
        ensureHubImport();
        return ['PrimeHub()', pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_display_text'] = function(block, generator) {
        ensureHubImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        const text = generator.valueToCode(block, 'TEXT', pythonGenerator.ORDER_NONE) || "''";
        return `${hub}.display.text(${text})\n`;
      };

      pythonGenerator.forBlock['pybricks_drivebase_init'] = function(block, generator) {
        ensureDriveBaseImport();
        const left = generator.valueToCode(block, 'LEFT', pythonGenerator.ORDER_NONE) || 'left_motor';
        const right = generator.valueToCode(block, 'RIGHT', pythonGenerator.ORDER_NONE) || 'right_motor';
        const wheel = generator.valueToCode(block, 'WHEEL', pythonGenerator.ORDER_NONE) || '56';
        const axle = generator.valueToCode(block, 'AXLE', pythonGenerator.ORDER_NONE) || '120';
        const code = `DriveBase(${left}, ${right}, ${wheel}, ${axle})`;
        return [code, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_drivebase_straight'] = function(block, generator) {
        ensureDriveBaseImport();
        const db = generator.valueToCode(block, 'DB', pythonGenerator.ORDER_NONE) || 'drivebase';
        const dist = generator.valueToCode(block, 'DIST', pythonGenerator.ORDER_NONE) || '0';
        return `${db}.straight(${dist})\n`;
      };

      pythonGenerator.forBlock['pybricks_drivebase_turn'] = function(block, generator) {
        ensureDriveBaseImport();
        const db = generator.valueToCode(block, 'DB', pythonGenerator.ORDER_NONE) || 'drivebase';
        const angle = generator.valueToCode(block, 'ANGLE', pythonGenerator.ORDER_NONE) || '0';
        return `${db}.turn(${angle})\n`;
      };

      function ensureSensorImports() {
        pythonGenerator.definitions_ = pythonGenerator.definitions_ || {};
        pythonGenerator.definitions_['import_pybricks_color'] = 'from pybricks.pupdevices import ColorSensor';
        pythonGenerator.definitions_['import_pybricks_ultrasonic'] = 'from pybricks.pupdevices import UltrasonicSensor';
        pythonGenerator.definitions_['import_pybricks_touch'] = 'from pybricks.pupdevices import TouchSensor';
      }

      pythonGenerator.forBlock['pybricks_color_sensor_init'] = function(block, generator) {
        ensureSensorImports();
        const port = getPortCode(block, generator);
        return [`ColorSensor(${port})`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_color_sensor_color'] = function(block, generator) {
        ensureSensorImports();
        const sensorVar = generator.valueToCode(block, 'SENSOR', pythonGenerator.ORDER_NONE) || 'color_sensor';
        const code = `${sensorVar}.color()`;
        return [code, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_ultrasonic_sensor_init'] = function(block, generator) {
        ensureSensorImports();
        const port = getPortCode(block, generator);
        return [`UltrasonicSensor(${port})`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_ultrasonic_sensor_distance'] = function(block, generator) {
        ensureSensorImports();
        const sensorVar = generator.valueToCode(block, 'SENSOR', pythonGenerator.ORDER_NONE) || 'ultrasonic_sensor';
        const code = `${sensorVar}.distance()`;
        return [code, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_tilt'] = function(block, generator) {
        ensureHubImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        const axis = block.getFieldValue('AXIS') || 'PITCH';
        const index = axis === 'ROLL' ? 1 : 0;
        const code = `${hub}.imu.tilt()[${index}]`;
        return [code, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_imu_ready'] = function(block, generator) {
        ensureHubImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        return [`${hub}.imu.ready()`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_imu_stationary'] = function(block, generator) {
        ensureHubImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        return [`${hub}.imu.stationary()`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_imu_up'] = function(block, generator) {
        ensureHubImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        return [`${hub}.imu.up()`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_imu_acceleration'] = function(block, generator) {
        ensureHubImport();
        ensureAxisImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        const axis = block.getFieldValue('AXIS') || 'Axis.X';
        return [`${hub}.imu.acceleration(${axis})`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_imu_angular_velocity'] = function(block, generator) {
        ensureHubImport();
        ensureAxisImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        const axis = block.getFieldValue('AXIS') || 'Axis.X';
        return [`${hub}.imu.angular_velocity(${axis})`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_imu_heading'] = function(block, generator) {
        ensureHubImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        return [`${hub}.imu.heading()`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_imu_reset_heading'] = function(block, generator) {
        ensureHubImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        const angle = generator.valueToCode(block, 'ANGLE', pythonGenerator.ORDER_NONE) || '0';
        return `${hub}.imu.reset_heading(${angle})\n`;
      };

      pythonGenerator.forBlock['pybricks_hub_imu_rotation'] = function(block, generator) {
        ensureHubImport();
        ensureAxisImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        const axis = block.getFieldValue('AXIS') || 'Axis.X';
        return [`${hub}.imu.rotation(${axis})`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_hub_imu_orientation'] = function(block, generator) {
        ensureHubImport();
        const hub = generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';
        return [`${hub}.imu.orientation()`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_touch_sensor_init'] = function(block, generator) {
        ensureSensorImports();
        const port = getPortCode(block, generator);
        return [`TouchSensor(${port})`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.forBlock['pybricks_touch_sensor_pressed'] = function(block, generator) {
        ensureSensorImports();
        const sensorVar = generator.valueToCode(block, 'SENSOR', pythonGenerator.ORDER_NONE) || 'touch_sensor';
        return [`${sensorVar}.pressed()`, pythonGenerator.ORDER_FUNCTION_CALL];
      };

      pythonGenerator.scrubNakedValue = function(line) { return line + '\n'; };

      pythonGenerator.forBlock['procedures_defnoreturn'] = function(block, generator) {
        console.log('procedures_defnoreturn');
        const funcName = generator.nameDB_.getName(block.getFieldValue('NAME'),
                                                   Blockly.Procedures.NAME_TYPE);
        const branch = generator.statementToCode(block, 'STACK');
        const code = `def ${funcName}(${block.getVars().join(', ')}):\n${branch || '  pass\n'}`;
        return code + '\n';
      };

      if (!pythonGenerator.__unoFinishPatched) {
        pythonGenerator.__unoFinishPatched = true;
        pythonGenerator.finish = function(code) {
          // Skip variable declarations and prepend imports before emitted code.
          const imports = this.definitions_;
          const definitions = Object.values(imports || {}).join('\n');
          return definitions + '\n' + code;
        };
      }

      return { Blockly, pythonGenerator };
    })();
  }
  return blocklyLoader;
}

export async function loadBlockly() {
  return ensureBlocklyLoaded();
}

// Full, classic-style category toolbox
export const FULL_TOOLBOX = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category', name: 'Logic', colour: '#5C81A6',
      contents: [
        { kind: 'block', type: 'controls_if' },
        { kind: 'block', type: 'controls_if', extraState: { 'hasElse': true } },
        { kind: 'block', type: 'logic_compare' },
        { kind: 'block', type: 'logic_operation' },
        { kind: 'block', type: 'logic_negate' },
        { kind: 'block', type: 'logic_boolean' },
        { kind: 'block', type: 'logic_null' },
        { kind: 'block', type: 'logic_ternary' }
      ]
    },
    {
      kind: 'category', name: 'Loops', colour: '#5CA65C',
      contents: [
        {
          kind: 'block', type: 'controls_repeat_ext',
          inputs: {
            TIMES: { shadow: { type: 'math_number', fields: { NUM: 10 } } }
          }
        },
        { kind: 'block', type: 'controls_whileUntil' },
        { kind: 'block', type: 'controls_for',
          inputs: {
            FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            TO:   { shadow: { type: 'math_number', fields: { NUM: 10 } } },
            BY:   { shadow: { type: 'math_number', fields: { NUM: 1 } } }
          }
        },
        { kind: 'block', type: 'controls_forEach' },
        { kind: 'block', type: 'controls_flow_statements' }
      ]
    },
    {
      kind: 'category', name: 'Math', colour: '#5C68A6',
      contents: [
        { kind: 'block', type: 'math_number', fields: { NUM: 0 } },
        { kind: 'block', type: 'math_arithmetic' },
        { kind: 'block', type: 'math_single' },
        { kind: 'block', type: 'math_trig' },
        { kind: 'block', type: 'math_constant' },
        { kind: 'block', type: 'math_number_property' },
        { kind: 'block', type: 'math_round' },
        { kind: 'block', type: 'math_on_list' },
        { kind: 'block', type: 'math_modulo' },
        { kind: 'block', type: 'math_constrain',
          inputs: {
            LOW:  { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            HIGH: { shadow: { type: 'math_number', fields: { NUM: 100 } } }
          }
        },
        { kind: 'block', type: 'math_random_int',
          inputs: {
            FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
            TO:   { shadow: { type: 'math_number', fields: { NUM: 10 } } }
          }
        },
        { kind: 'block', type: 'math_random_float' }
      ]
    },
    { kind: 'sep', gap: 12 },
    {
      kind: 'category', name: 'Hub', colour: '#C66A21',
      contents: [
        {
          kind: 'block',
          type: 'pybricks_hub_init'
        },
        { kind: 'block', type: 'pybricks_hub_display_text' },
        { kind: 'block', type: 'pybricks_port', fields: { PORT: 'Port.A' } },
        { kind: 'block', type: 'pybricks_port', fields: { PORT: 'Port.B' } },
        { kind: 'block', type: 'pybricks_port', fields: { PORT: 'Port.C' } },
        { kind: 'block', type: 'pybricks_port', fields: { PORT: 'Port.D' } },
        { kind: 'block', type: 'pybricks_port', fields: { PORT: 'Port.E' } },
        { kind: 'block', type: 'pybricks_port', fields: { PORT: 'Port.F' } },
        { kind: 'block', type: 'pybricks_hub_tilt' },
        { kind: 'block', type: 'pybricks_hub_imu_ready' },
        { kind: 'block', type: 'pybricks_hub_imu_stationary' },
        { kind: 'block', type: 'pybricks_hub_imu_up' },
        { kind: 'block', type: 'pybricks_hub_imu_acceleration' },
        { kind: 'block', type: 'pybricks_hub_imu_angular_velocity' },
        { kind: 'block', type: 'pybricks_hub_imu_heading' },
        { kind: 'block', type: 'pybricks_hub_imu_reset_heading' },
        { kind: 'block', type: 'pybricks_hub_imu_rotation' },
        { kind: 'block', type: 'pybricks_hub_imu_orientation' }
      ]
    },
    {
      kind: 'category', name: 'Motors', colour: '#5C68A6',
      contents: [
        { kind: 'block', type: 'pybricks_motor_init' },
        {
          kind: 'block',
          type: 'pybricks_motor_run',
          inputs: {
            SPEED: { shadow: { type: 'math_number', fields: { NUM: 360 } } }
          }
        },
        {
          kind: 'block',
          type: 'pybricks_motor_run_time',
          inputs: {
            SPEED: { shadow: { type: 'math_number', fields: { NUM: 360 } } },
            TIME: { shadow: { type: 'math_number', fields: { NUM: 1 } } }
          }
        },
        {
          kind: 'block',
          type: 'pybricks_motor_run_angle',
          inputs: {
            SPEED: { shadow: { type: 'math_number', fields: { NUM: 360 } } },
            ANGLE: { shadow: { type: 'math_number', fields: { NUM: 180 } } }
          }
        },
        { kind: 'block', type: 'pybricks_motor_stop' },
        {
          kind: 'block',
          type: 'pybricks_drivebase_init',
          inputs: {
            WHEEL: { shadow: { type: 'math_number', fields: { NUM: 56 } } },
            AXLE: { shadow: { type: 'math_number', fields: { NUM: 120 } } }
          }
        },
        {
          kind: 'block',
          type: 'pybricks_drivebase_straight',
          inputs: {
            DIST: { shadow: { type: 'math_number', fields: { NUM: 100 } } }
          }
        },
        {
          kind: 'block',
          type: 'pybricks_drivebase_turn',
          inputs: {
            ANGLE: { shadow: { type: 'math_number', fields: { NUM: 90 } } }
          }
        }
      ]
    },
    {
      kind: 'category', name: 'Sensors', colour: '#7A4FBF',
      contents: [
        { kind: 'block', type: 'pybricks_color_sensor_init' },
        { kind: 'block', type: 'pybricks_color_sensor_color' },
        { kind: 'block', type: 'pybricks_ultrasonic_sensor_init' },
        { kind: 'block', type: 'pybricks_ultrasonic_sensor_distance' },
        { kind: 'block', type: 'pybricks_touch_sensor_init' },
        { kind: 'block', type: 'pybricks_touch_sensor_pressed' },
      ]
    },
    {
      kind: 'category', name: 'Text', colour: '#5CA68D',
      contents: [
        { kind: 'block', type: 'text' },
        { kind: 'block', type: 'text_join' },
        { kind: 'block', type: 'text_append' },
        { kind: 'block', type: 'text_length' },
        { kind: 'block', type: 'text_isEmpty' },
        { kind: 'block', type: 'text_indexOf' },
        { kind: 'block', type: 'text_charAt' },
        { kind: 'block', type: 'text_getSubstring' },
        { kind: 'block', type: 'text_changeCase' },
        { kind: 'block', type: 'text_trim' },
        { kind: 'block', type: 'text_print',
          inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'Hello' } } } }
        },
        { kind: 'block', type: 'text_prompt_ext',
          inputs: { TEXT: { shadow: { type: 'text', fields: { TEXT: 'Enter value:' } } } }
        }
      ]
    },
    /*{
      kind: 'category', name: 'Lists', colour: '#745CA6',
      contents: [
        { kind: 'block', type: 'lists_create_with' },
        { kind: 'block', type: 'lists_repeat',
          inputs: {
            NUM:  { shadow: { type: 'math_number', fields: { NUM: 5 } } }
          }
        },
        { kind: 'block', type: 'lists_length' },
        { kind: 'block', type: 'lists_isEmpty' },
        { kind: 'block', type: 'lists_indexOf' },
        { kind: 'block', type: 'lists_getIndex' },
        { kind: 'block', type: 'lists_setIndex' },
        { kind: 'block', type: 'lists_getSublist' },
        { kind: 'block', type: 'lists_sort' },
        { kind: 'block', type: 'lists_split' }
      ]
    },//*/
    // Dynamic categories (auto-manage their contents)
    { kind: 'sep', gap: 12 },
    {
      kind: 'category', name: 'Variables', colour: '#A65C81', custom: 'VARIABLE'
    },
    {
      kind: 'category', name: 'Functions', colour: '#9A5CA6', custom: 'PROCEDURE'
    }

  ]
};


export const BLOCKLY_CSS = html`
  <style>
    .blocklyWidgetDiv,
    .blocklyDropDownDiv {
      z-index: 999999 !important;
      pointer-events: auto !important;
    }
    .blockly-modal__header {
      display: flex;
      justify-content: flex-end;
      padding: 0.6rem 0.9rem;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      z-index: 1;
    }
    .blockly-modal__close {
    }
  </style>
`
