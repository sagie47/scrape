import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export default function ObsidianDropdown({
    value,
    onChange,
    options = [],
    placeholder = "Select an option...",
    icon: Icon = null,
    label = null
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [coords, setCoords] = useState({})
    const dropdownRef = useRef(null)

    // Calculate position when opening
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const updatePosition = () => {
                const rect = dropdownRef.current.getBoundingClientRect()
                setCoords({
                    top: rect.bottom + 8, // 8px gap
                    left: rect.left,
                    width: rect.width
                })
            }
            updatePosition()
            window.addEventListener('scroll', updatePosition)
            window.addEventListener('resize', updatePosition)
            return () => {
                window.removeEventListener('scroll', updatePosition)
                window.removeEventListener('resize', updatePosition)
            }
        }
    }, [isOpen])

    // Handle click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                // Also check if click is inside the portal menu
                const menu = document.getElementById(`dropdown-menu-${label || 'default'}`)
                if (menu && menu.contains(event.target)) return
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [dropdownRef, label])

    const selectedOption = options.find(opt => opt.value === value)
    const menuId = `dropdown-menu-${label || 'default'}`

    return (
        <div className="obsidian-dropdown-container" ref={dropdownRef}>
            {/* Label (Optional) */}
            {label && (
                <div className="obsidian-dropdown-label">
                    {Icon && <Icon size={14} className="dropdown-label-icon" />}
                    <span>{label}</span>
                </div>
            )}

            {/* Trigger Button */}
            <div
                className={`obsidian-dropdown-trigger ${isOpen ? 'is-open' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={`trigger-text ${!selectedOption ? 'placeholder' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className={`trigger-chevron ${isOpen ? 'rotate' : ''}`} />
            </div>

            {/* Portal Menu */}
            {isOpen && createPortal(
                <div
                    id={menuId}
                    className="obsidian-dropdown-menu animate-fade-in-down"
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        zIndex: 99999, // Ensure it's on top of everything
                        maxHeight: '300px',
                        overflowY: 'auto'
                    }}
                >
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className={`dropdown-option ${value === option.value ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(option.value)
                                setIsOpen(false)
                            }}
                        >
                            <span className="option-label">{option.label}</span>
                            {value === option.value && <Check size={14} className="option-check" />}

                            {option.subtext && <span className="option-subtext">{option.subtext}</span>}
                        </div>
                    ))}

                    {options.length === 0 && (
                        <div className="dropdown-empty">No options available</div>
                    )}
                </div>,
                document.body
            )}
        </div>
    )
}
