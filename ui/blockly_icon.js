export function setup_blockly_display_icon(Blockly, pythonGenerator) {


  Blockly.defineBlocksWithJsonArray([
          {
            type: 'pybricks_hub_display_icon',
            message0: '%1 display %2',
            args0: [
              { type: 'input_value', name: 'HUB', check: 'PrimeHub' },
              {
                type: 'field_dropdown',
                name: 'ICON',
                options: [
                  ['UP', 'Icon.UP'],
                  ['DOWN', 'Icon.DOWN'],
                  ['LEFT', 'Icon.LEFT'],
                  ['RIGHT', 'Icon.RIGHT'],
                  ['ARROW_RIGHT_UP', 'Icon.ARROW_RIGHT_UP'],
                  ['ARROW_RIGHT_DOWN', 'Icon.ARROW_RIGHT_DOWN'],
                  ['ARROW_LEFT_UP', 'Icon.ARROW_LEFT_UP'],
                  ['ARROW_LEFT_DOWN', 'Icon.ARROW_LEFT_DOWN'],
                  ['ARROW_UP', 'Icon.ARROW_UP'],
                  ['ARROW_DOWN', 'Icon.ARROW_DOWN'],
                  ['ARROW_LEFT', 'Icon.ARROW_LEFT'],
                  ['ARROW_RIGHT', 'Icon.ARROW_RIGHT'],
                  ['HAPPY', 'Icon.HAPPY'],
                  ['SAD', 'Icon.SAD'],
                  ['EYE_LEFT', 'Icon.EYE_LEFT'],
                  ['EYE_RIGHT', 'Icon.EYE_RIGHT'],
                  ['EYE_LEFT_BLINK', 'Icon.EYE_LEFT_BLINK'],
                  ['EYE_RIGHT_BLINK', 'Icon.EYE_RIGHT_BLINK'],
                  ['EYE_RIGHT_BROW', 'Icon.EYE_RIGHT_BROW'],
                  ['EYE_LEFT_BROW', 'Icon.EYE_LEFT_BROW'],
                  ['EYE_LEFT_BROW_UP', 'Icon.EYE_LEFT_BROW_UP'],
                  ['EYE_RIGHT_BROW_UP', 'Icon.EYE_RIGHT_BROW_UP'],
                  ['HEART', 'Icon.HEART'],
                  ['PAUSE', 'Icon.PAUSE'],
                  ['EMPTY', 'Icon.EMPTY'],
                  ['FULL', 'Icon.FULL'],
                  ['SQUARE', 'Icon.SQUARE'],
                  ['TRIANGLE_RIGHT', 'Icon.TRIANGLE_RIGHT'],
                  ['TRIANGLE_LEFT', 'Icon.TRIANGLE_LEFT'],
                  ['TRIANGLE_UP', 'Icon.TRIANGLE_UP'],
                  ['TRIANGLE_DOWN', 'Icon.TRIANGLE_DOWN'],
                  ['CIRCLE', 'Icon.CIRCLE'],
                  ['CLOCKWISE', 'Icon.CLOCKWISE'],
                  ['COUNTERCLOCKWISE', 'Icon.COUNTERCLOCKWISE'],
                  ['TRUE', 'Icon.TRUE'],
                  ['FALSE', 'Icon.FALSE'],
                ],
              },
            ],
            previousStatement: null,
            nextStatement: null,
            colour: '#fac80a',
            tooltip: 'Display an icon on the hub.',
            helpUrl: 'https://docs.pybricks.com/en/latest/hubs/primehub.html#making-your-own-images'
          },
  ]);


  // Generator: hub.display.icon(Icon.X)
  pythonGenerator.forBlock['pybricks_hub_display_icon'] = function (block, generator) {
    // Ensure imports once in your environment (adjust helpers to your codebase):
    // from pybricks.parameters import Icon
    if (typeof ensureParameterImports === 'function') {
      ensureParameterImports(['Icon']);
    }

    const hubExpr =
      generator.valueToCode(block, 'HUB', pythonGenerator.ORDER_NONE) || 'hub';

    // Dropdown stores values like "Icon.UP"
    const iconValue = block.getFieldValue('ICON') || 'Icon.HAPPY';

    const code = `${hubExpr}.display.icon(${iconValue})\n`;
    return code; // statement block
  };


}

