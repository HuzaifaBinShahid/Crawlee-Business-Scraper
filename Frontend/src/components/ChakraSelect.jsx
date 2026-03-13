import React, { useMemo } from 'react';
import { Select, createListCollection } from '@chakra-ui/react';

export function ChakraSelect({ label, value, onChange, options, placeholder = 'Select...' }) {
  const items = useMemo(
    () =>
      options.map((opt) => ({
        label: typeof opt === 'object' ? opt.label : opt,
        value: String(typeof opt === 'object' ? opt.value : opt),
      })),
    [options],
  );

  const collection = useMemo(() => createListCollection({ items }), [items]);

  return (
    <Select.Root
      collection={collection}
      value={value ? [String(value)] : []}
      onValueChange={(details) => onChange(details.value?.[0] ?? '')}
      size="md"
      variant="outline"
      colorPalette="neutral"
    >
      <Select.Label>{label}</Select.Label>
      <Select.Control>
        <Select.Trigger>
          <Select.ValueText placeholder={placeholder} />
        </Select.Trigger>
        <Select.IndicatorGroup>
          <Select.Indicator />
        </Select.IndicatorGroup>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          <Select.List>
            {collection.items.map((item) => (
              <Select.Item key={item.value} item={item}>
                <Select.ItemText>{item.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.List>
        </Select.Content>
      </Select.Positioner>
      <Select.HiddenSelect />
    </Select.Root>
  );
}
