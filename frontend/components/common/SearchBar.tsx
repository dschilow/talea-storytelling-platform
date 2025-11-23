import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { colors } from '../../utils/constants/colors';
import { spacing, radii } from '../../utils/constants/spacing';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  defaultValue?: string;
  autoFocus?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Suche nach Stories, Avataren...",
  onSearch,
  defaultValue = "",
  autoFocus = false,
}) => {
  const [query, setQuery] = useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    onSearch("");
  };

  return (
    <form onSubmit={handleSubmit} style={searchContainer}>
      <Search size={20} color={colors.text.secondary} style={searchIcon} />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        style={searchInput}
        autoFocus={autoFocus}
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          style={clearButton}
          aria-label="Clear search"
        >
          <X size={18} color={colors.text.secondary} />
        </button>
      )}
    </form>
  );
};

const searchContainer: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '600px',
};

const searchIcon: React.CSSProperties = {
  position: 'absolute',
  left: spacing.md,
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
};

const searchInput: React.CSSProperties = {
  width: '100%',
  padding: `${spacing.md} ${spacing.md} ${spacing.md} ${spacing.xxl}`,
  borderRadius: radii.full,
  border: `2px solid ${colors.border.light}`,
  background: colors.glass.background,
  backdropFilter: 'blur(10px)',
  color: colors.text.primary,
  fontSize: '16px',
  fontFamily: 'inherit',
  transition: 'all 0.2s ease',
  outline: 'none',
};

const clearButton: React.CSSProperties = {
  position: 'absolute',
  right: spacing.md,
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: spacing.xs,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: radii.sm,
  transition: 'background 0.2s ease',
};

export default SearchBar;
