import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CharacterSearch from './CharacterSearch';

const suggestions = [
  { label: 'Zarlyn Forever', name: 'zarlyn', surname: 'forever', detail: 'Mage', ruleset: 'PvP', region: 'eu' },
  { label: 'Zarly Pose', name: 'zarly', surname: 'pose', detail: 'Druid', ruleset: 'Normal', region: 'eu' }
];

const SearchFixture = ({ onSelect, onSearch, error = '', loading = false }) => {
  const [value, setValue] = useState('zarly');
  const [open, setOpen] = useState(false);
  return (
    <CharacterSearch
      value={value}
      onChange={setValue}
      onSearch={onSearch}
      onSelect={onSelect}
      suggestions={error ? [] : suggestions}
      isForever
      loading={loading}
      error={error}
      open={open}
      onOpenChange={setOpen}
      getClassColor={() => '#fff'}
    />
  );
};

it('allows selecting a live suggestion with the keyboard', () => {
  const onSelect = jest.fn();
  render(<SearchFixture onSelect={onSelect} onSearch={jest.fn()} />);
  const input = screen.getByRole('combobox', { name: 'Character name' });
  fireEvent.focus(input);
  expect(screen.getByText('Mage · PvP · EU')).toBeTruthy();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith(suggestions[1]);
  expect(screen.queryByRole('listbox')).toBeNull();
});

it('uses Arial for the live search loading message', () => {
  render(<SearchFixture onSelect={jest.fn()} onSearch={jest.fn()} loading />);
  fireEvent.focus(screen.getByRole('combobox', { name: 'Character name' }));
  expect(screen.getByRole('status').style.fontFamily).toBe('Arial, sans-serif');
});

it('keeps direct search available and exposes suggestion errors', () => {
  const onSearch = jest.fn();
  render(<SearchFixture onSelect={jest.fn()} onSearch={onSearch} error="Search unavailable" />);
  const input = screen.getByRole('combobox', { name: 'Character name' });
  fireEvent.focus(input);
  expect(screen.getByRole('alert').textContent).toBe('Search unavailable');
  expect(screen.getByRole('alert').style.fontFamily).toBe('Arial, sans-serif');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onSearch).toHaveBeenCalledTimes(1);
});
