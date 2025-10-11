let blocklyLoader;

async function ensureBlocklyLoaded() {
  if (!blocklyLoader) {
    blocklyLoader = (async () => {
      const blocklyModule = await import('blockly/core');
      const Blockly = blocklyModule.default || blocklyModule;
      await import('blockly/blocks');
      const pythonModule = await import('blockly/python');
      const pythonGenerator = pythonModule.pythonGenerator;

      if (!Blockly.Blocks['say_hello']) {
        Blockly.defineBlocksWithJsonArray([
          {
            type: 'say_hello',
            message0: 'say hello to %1',
            args0: [
              { type: 'input_value', name: 'NAME' }
            ],
            colour: 160,
            tooltip: 'Prints a greeting',
            helpUrl: ''
          }
        ]);
      }

      pythonGenerator.forBlock['say_hello'] = function(block, generator) {
        const name = generator.valueToCode(block, 'NAME', pythonGenerator.ORDER_NONE) || '"world"';
        const code = `print("Hello, " + str(${name}))\n`;
        return code;
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
    /*{
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
    },//*/
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
    },

    {
      kind: 'category', name: 'Other', colour: '#5C68A6',
      contents: [
        { kind: 'block', type: 'say_hello', },
      ]
    },

  ]
};
