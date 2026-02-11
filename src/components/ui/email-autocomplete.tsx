"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { searchMails, MailSearchResult } from "@/lib/actions/mails";
import { Mail, Loader2 } from "lucide-react";

type EmailAutocompleteProps = {
    value: string;
    onChange: (value: string) => void;
    onSelect: (email: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    excludeEmails?: string[];
};

export function EmailAutocomplete({
    value,
    onChange,
    onSelect,
    onKeyDown,
    placeholder = "ornek@email.com",
    className,
    excludeEmails = [],
}: EmailAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<MailSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    // Simplified rendering: No portal, no complex event handling.
    // Just render below the input. If it causes scroll, so be it - better than not working.
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const fetchSuggestions = useCallback(
        async (query: string) => {
            if (query.trim().length < 1) {
                setSuggestions([]);
                setShowDropdown(false);
                return;
            }

            setIsLoading(true);
            try {
                const results = await searchMails(query);
                // Filter out already-added emails
                const filtered = results.filter(
                    (item) => !excludeEmails.includes(item.mail.toLowerCase())
                );
                setSuggestions(filtered);
                if (filtered.length > 0) {
                    setShowDropdown(true);
                } else {
                    setShowDropdown(false);
                }
                setHighlightedIndex(-1);
            } catch (error) {
                console.error("Error fetching mail suggestions:", error);
                setSuggestions([]);
                setShowDropdown(false);
            } finally {
                setIsLoading(false);
            }
        },
        [excludeEmails]
    );

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        if (value.trim().length < 1) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        debounceRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 250);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [value, fetchSuggestions]);

    const handleSelect = (email: string) => {
        onSelect(email);
        setSuggestions([]);
        setShowDropdown(false);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (showDropdown && suggestions.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                return;
            }

            if (e.key === "Enter" && highlightedIndex >= 0) {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(suggestions[highlightedIndex].mail);
                return;
            }

            if (e.key === "Escape") {
                setShowDropdown(false);
                setHighlightedIndex(-1);
                return;
            }
        }

        // Forward key events that we didn't handle
        onKeyDown?.(e);
    };

    // Highlight matching text in suggestions
    const highlightMatch = (text: string, query: string) => {
        if (!text) return null;

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase().trim();
        const index = lowerText.indexOf(lowerQuery);

        if (index === -1 || !lowerQuery) {
            return <span>{text}</span>;
        }

        return (
            <span>
                {text.slice(0, index)}
                <span className="font-semibold text-primary">
                    {text.slice(index, index + lowerQuery.length)}
                </span>
                {text.slice(index + lowerQuery.length)}
            </span>
        );
    };

    return (
        <div className="relative flex-1 group">
            <div className="relative">
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                        // Delay hiding so verify clicking works
                        setTimeout(() => setShowDropdown(false), 200);
                    }}
                    onFocus={() => {
                        if (suggestions.length > 0) {
                            setShowDropdown(true);
                        }
                    }}
                    className={className}
                    autoComplete="off"
                />
                {isLoading && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>

            {showDropdown && suggestions.length > 0 && (
                <div
                    className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-[200px] overflow-y-auto"
                >
                    {suggestions.map((item, index) => (
                        <button
                            key={item.mail}
                            type="button"
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-accent hover:text-accent-foreground ${index === highlightedIndex
                                ? "bg-accent text-accent-foreground"
                                : ""
                                }`}
                            onClick={() => handleSelect(item.mail)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                        >
                            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                            <div className="flex flex-col overflow-hidden">
                                <span className="truncate">
                                    {highlightMatch(item.mail, value)}
                                </span>
                                {item.name && (
                                    <span className="text-xs text-muted-foreground truncate">
                                        {highlightMatch(item.name, value)}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
