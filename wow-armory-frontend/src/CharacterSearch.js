import React, { useId, useState } from 'react';

const CharacterSearch = ({
  value, onChange, onSearch, onSelect, suggestions, isForever,
  loading, error, open, onOpenChange, getClassColor, compact = false
}) => {
  const listId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const showResults = open && (
    suggestions.length > 0 || (isForever && value.trim().length >= 2)
  );

  const selectSuggestion = (suggestion) => {
    setActiveIndex(-1);
    onOpenChange(false);
    onSelect(suggestion);
  };

  return (
    <div
      className="relative min-w-[180px] flex-1"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onOpenChange(false);
          setActiveIndex(-1);
        }
      }}
    >
      <input
        type="search"
        role="combobox"
        aria-label={compact ? 'Search another character' : 'Character name'}
        aria-autocomplete="list"
        aria-expanded={showResults}
        aria-controls={showResults ? listId : undefined}
        aria-activedescendant={showResults && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        placeholder={isForever ? 'First and Last Name' : 'Character Name'}
        value={value}
        onChange={event => {
          onChange(event.target.value);
          setActiveIndex(-1);
          onOpenChange(true);
        }}
        onFocus={() => onOpenChange(true)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' && suggestions.length) {
            event.preventDefault();
            onOpenChange(true);
            setActiveIndex(index => Math.min(index + 1, suggestions.length - 1));
          } else if (event.key === 'ArrowUp' && suggestions.length) {
            event.preventDefault();
            onOpenChange(true);
            setActiveIndex(index => index <= 0 ? suggestions.length - 1 : index - 1);
          } else if (event.key === 'Escape') {
            onOpenChange(false);
            setActiveIndex(-1);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            if (showResults && suggestions[activeIndex]) {
              selectSuggestion(suggestions[activeIndex]);
            } else {
              onOpenChange(false);
              onSearch();
            }
          }
        }}
        className={`w-full rounded border-2 bg-black bg-opacity-60 text-white placeholder-gray-500 focus:outline-none font-sans ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}
        style={{ borderColor: '#8B7355', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)' }}
      />
      {showResults && (
        <div
          className="absolute z-40 mt-1 max-h-72 w-full overflow-y-auto rounded border-2 bg-black bg-opacity-95"
          style={{ borderColor: '#8B7355', boxShadow: '0 8px 24px rgba(0,0,0,0.9)' }}
        >
          <div id={listId} role="listbox" aria-label="Character search suggestions">
            {suggestions.map((suggestion, index) => (
              <button
                type="button"
                id={`${listId}-${index}`}
                key={`${suggestion.region || suggestion.selectedRealm}-${suggestion.label || suggestion.name}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={event => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                className={`flex w-full items-center gap-3 border-b border-gray-800 px-4 py-3 text-left font-sans text-white last:border-0 hover:bg-blue-900 hover:bg-opacity-30 ${index === activeIndex ? 'bg-blue-900 bg-opacity-30' : ''}`}
              >
                {isForever && (
                  suggestion.portrait ? (
                    <img src={suggestion.portrait} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                  ) : <div className="h-8 w-8 shrink-0 rounded bg-gray-800" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold" style={{ color: getClassColor(suggestion.detail) }}>
                    {suggestion.label || suggestion.name}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {isForever
                      ? [suggestion.detail, suggestion.ruleset, suggestion.region?.toUpperCase()].filter(Boolean).join(' · ')
                      : suggestion.realmLabel}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {loading && <div className="px-4 py-3 text-sm text-gray-400" style={{ fontFamily: 'Arial, sans-serif' }} role="status">Searching characters...</div>}
          {error && <div className="px-4 py-3 text-sm text-red-300" style={{ fontFamily: 'Arial, sans-serif' }} role="alert">{error}</div>}
          {isForever && !loading && !error && suggestions.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-300">
              No suggestions found. Enter the full name to search directly.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CharacterSearch;
