import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import PlaceSearchInput from '../PlaceSearchInput';
import { searchPlaces } from '../../api/photon';

jest.mock('../../api/photon', () => ({
  searchPlaces: jest.fn(),
}));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('PlaceSearchInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with placeholder', async () => {
    const { getByPlaceholderText } = await render(
      <PlaceSearchInput placeholder="Search here..." onPlaceSelected={jest.fn()} />
    );
    expect(getByPlaceholderText('Search here...')).toBeTruthy();
  });

  it('debounces place search on text input >= 2 chars', async () => {
    searchPlaces.mockResolvedValue([
      { label: 'Mumbai Central, Mumbai', lat: 18.922, lon: 72.834, osm_value: 'station' },
    ]);

    const { getByPlaceholderText } = await render(
      <PlaceSearchInput placeholder="Search here..." onPlaceSelected={jest.fn()} debounceMs={300} />
    );
    const input = getByPlaceholderText('Search here...');

    await act(async () => {
      fireEvent.changeText(input, 'Mu');
    });

    // Should not trigger search immediately
    await sleep(50);
    expect(searchPlaces).not.toHaveBeenCalled();

    // Wait past debounce time
    await waitFor(() => {
      expect(searchPlaces).toHaveBeenCalledWith('Mu', 18.9220, 72.8347);
    });
  });

  it('calls onPlaceSelected when result is tapped and sets value', async () => {
    const mockOnPlaceSelected = jest.fn();
    searchPlaces.mockResolvedValue([
      { label: 'Mumbai CST, Mumbai', lat: 18.9225, lon: 72.8355, osm_value: 'station' },
    ]);

    const { getByPlaceholderText, getByText } = await render(
      <PlaceSearchInput
        placeholder="Search here..."
        onPlaceSelected={mockOnPlaceSelected}
        debounceMs={0}
      />
    );
    const input = getByPlaceholderText('Search here...');

    await act(async () => {
      fireEvent.changeText(input, 'Mumbai');
    });

    // Wait for the immediate search to finish and suggestions list to render
    const suggestionText = await waitFor(() => getByText('Mumbai CST'));
    expect(suggestionText).toBeTruthy();

    await act(async () => {
      fireEvent.press(suggestionText);
    });

    expect(mockOnPlaceSelected).toHaveBeenCalledWith({
      label: 'Mumbai CST, Mumbai',
      lat: 18.9225,
      lon: 72.8355,
    });
    expect(input.props.value).toBe('Mumbai CST, Mumbai');
  });

  it('shows clear button and clears input + triggers onPlaceSelected(null)', async () => {
    const mockOnPlaceSelected = jest.fn();
    const { getByPlaceholderText, getByText } = await render(
      <PlaceSearchInput
        placeholder="Search here..."
        onPlaceSelected={mockOnPlaceSelected}
        debounceMs={0}
      />
    );
    const input = getByPlaceholderText('Search here...');

    await act(async () => {
      fireEvent.changeText(input, 'Mu');
    });
    expect(input.props.value).toBe('Mu');

    // Trigger clear
    const clearButton = getByText('×');
    await act(async () => {
      fireEvent.press(clearButton);
    });

    expect(input.props.value).toBe('');
    expect(mockOnPlaceSelected).toHaveBeenCalledWith(null);
  });
});
