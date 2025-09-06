# MobileFriendlyTooltip Component

A comprehensive tooltip component that works seamlessly across mobile and desktop devices with intelligent touch handling, customizable behavior, and accessibility features.

## Features

- ✅ **Mobile-First Design**: Detects touch devices and adapts behavior accordingly
- ✅ **Touch-Friendly**: Tap to open/close on mobile, hover on desktop
- ✅ **Auto-Close**: Configurable auto-close timer for mobile devices
- ✅ **Click Outside**: Close tooltips when tapping elsewhere on mobile
- ✅ **Accessibility**: Proper ARIA labels and keyboard navigation
- ✅ **Customizable**: Extensive configuration options for styling and behavior
- ✅ **TypeScript**: Full TypeScript support with comprehensive type definitions
- ✅ **Performance**: Optimized with proper cleanup and memory management

## Components

### `MobileFriendlyTooltip`

The main tooltip component with full customization options.

### `MobileFriendlyTooltipProvider`

Provider wrapper for tooltip configuration.

### `InfoTooltip`

Convenience component for simple info icon tooltips.

### `TextWithTooltip`

Component for text elements with tooltips.

## Basic Usage

```tsx
import {
  MobileFriendlyTooltip,
  MobileFriendlyTooltipProvider,
} from "@/components/ui/mobile-friendly-tooltip";

function MyComponent() {
  return (
    <MobileFriendlyTooltipProvider>
      <MobileFriendlyTooltip content="This is a helpful tooltip">
        <span>Hover or tap me</span>
      </MobileFriendlyTooltip>
    </MobileFriendlyTooltipProvider>
  );
}
```

## API Reference

### MobileFriendlyTooltip Props

| Prop               | Type                                     | Default    | Description                            |
| ------------------ | ---------------------------------------- | ---------- | -------------------------------------- |
| `content`          | `string`                                 | -          | **Required.** The tooltip content text |
| `children`         | `React.ReactNode`                        | -          | **Required.** The trigger element      |
| `showIcon`         | `boolean`                                | `true`     | Whether to show an info icon           |
| `iconSize`         | `"sm" \| "md" \| "lg"`                   | `"sm"`     | Icon size when showIcon is true        |
| `side`             | `"top" \| "bottom" \| "left" \| "right"` | `"top"`    | Tooltip positioning                    |
| `align`            | `"start" \| "center" \| "end"`           | `"center"` | Tooltip alignment                      |
| `sideOffset`       | `number`                                 | `5`        | Distance from trigger element          |
| `autoCloseDelay`   | `number`                                 | `5000`     | Auto-close timeout in ms (mobile only) |
| `triggerClassName` | `string`                                 | `""`       | Custom CSS classes for trigger wrapper |
| `contentClassName` | `string`                                 | `""`       | Custom CSS classes for tooltip content |
| `asButton`         | `boolean`                                | `true`     | Whether trigger should be a button     |
| `buttonType`       | `"button" \| "submit" \| "reset"`        | `"button"` | Button type when asButton is true      |
| `disabled`         | `boolean`                                | `false`    | Disabled state                         |
| `onOpenChange`     | `(open: boolean) => void`                | -          | Callback when tooltip opens/closes     |

### MobileFriendlyTooltipProvider Props

| Prop                      | Type              | Default | Description                             |
| ------------------------- | ----------------- | ------- | --------------------------------------- |
| `children`                | `React.ReactNode` | -       | **Required.** Child components          |
| `delayDuration`           | `number`          | `0`     | Delay before tooltip appears on hover   |
| `skipDelayDuration`       | `number`          | `0`     | Skip delay when moving between tooltips |
| `disableHoverableContent` | `boolean`         | `false` | Whether to disable hoverable content    |

### InfoTooltip Props

| Prop           | Type                                  | Default | Description                            |
| -------------- | ------------------------------------- | ------- | -------------------------------------- |
| `content`      | `string`                              | -       | **Required.** The tooltip content text |
| `size`         | `"sm" \| "md" \| "lg"`                | `"sm"`  | Icon size                              |
| `className`    | `string`                              | `""`    | Custom classes for the icon            |
| `tooltipProps` | `Partial<MobileFriendlyTooltipProps>` | `{}`    | Additional tooltip props               |

### TextWithTooltip Props

| Prop           | Type                                  | Default  | Description                       |
| -------------- | ------------------------------------- | -------- | --------------------------------- |
| `text`         | `string`                              | -        | **Required.** The visible text    |
| `tooltip`      | `string`                              | -        | **Required.** The tooltip content |
| `showIcon`     | `boolean`                             | `true`   | Whether to show info icon         |
| `as`           | `"span" \| "div" \| "p" \| "label"`   | `"span"` | Text element type                 |
| `className`    | `string`                              | `""`     | Custom classes for the text       |
| `tooltipProps` | `Partial<MobileFriendlyTooltipProps>` | `{}`     | Additional tooltip props          |

## Usage Examples

### Simple Info Tooltip

```tsx
import { InfoTooltip } from "@/components/ui/mobile-friendly-tooltip";

<div className="flex items-center gap-2">
  <span>API Rate Limit</span>
  <InfoTooltip content="Maximum requests per hour" />
</div>;
```

### Table Header with Tooltip

```tsx
<th className="text-left p-3">
  <MobileFriendlyTooltip content="The date when the transaction occurred">
    Date
  </MobileFriendlyTooltip>
</th>
```

### Form Field with Help Text

```tsx
<label className="flex items-center gap-2">
  <TextWithTooltip
    text="Email Address"
    tooltip="We'll use this email for important updates"
  />
</label>
```

### Custom Styling

```tsx
<MobileFriendlyTooltip
  content="Custom styled tooltip"
  triggerClassName="text-blue-600 font-semibold"
  contentClassName="bg-blue-50 border-blue-200"
  iconSize="lg"
>
  <span>Custom tooltip</span>
</MobileFriendlyTooltip>
```

### Different Positions

```tsx
{
  /* Top (default) */
}
<MobileFriendlyTooltip content="Top tooltip" side="top">
  <Button>Top</Button>
</MobileFriendlyTooltip>;

{
  /* Right */
}
<MobileFriendlyTooltip content="Right tooltip" side="right">
  <Button>Right</Button>
</MobileFriendlyTooltip>;

{
  /* Bottom */
}
<MobileFriendlyTooltip content="Bottom tooltip" side="bottom">
  <Button>Bottom</Button>
</MobileFriendlyTooltip>;

{
  /* Left */
}
<MobileFriendlyTooltip content="Left tooltip" side="left">
  <Button>Left</Button>
</MobileFriendlyTooltip>;
```

### Advanced Configuration

```tsx
{
  /* Quick auto-close */
}
<MobileFriendlyTooltip content="Closes after 2 seconds" autoCloseDelay={2000}>
  <span>Quick close</span>
</MobileFriendlyTooltip>;

{
  /* Manual close only */
}
<MobileFriendlyTooltip
  content="Only closes on tap/click outside"
  autoCloseDelay={0}
>
  <span>Manual close</span>
</MobileFriendlyTooltip>;

{
  /* With callback */
}
<MobileFriendlyTooltip
  content="Logs open/close events"
  onOpenChange={(open) => console.log(`Tooltip ${open ? "opened" : "closed"}`)}
>
  <span>With callback</span>
</MobileFriendlyTooltip>;

{
  /* No icon */
}
<MobileFriendlyTooltip content="No info icon shown" showIcon={false}>
  <span>No icon</span>
</MobileFriendlyTooltip>;
```

## Behavior Differences

### Desktop (Mouse/Hover)

- Tooltips appear on hover
- Disappear when mouse leaves
- Standard tooltip behavior

### Mobile (Touch)

- Tooltips appear on tap/touch
- Stay open until:
  - User taps the trigger again
  - User taps elsewhere on screen
  - Auto-close timer expires (default 5 seconds)
- Optimized for touch interaction

## Accessibility

- **Keyboard Navigation**: Full keyboard support with focus management
- **Screen Readers**: Proper ARIA labels and descriptions
- **Focus Management**: Visible focus indicators and logical tab order
- **Touch Targets**: Adequate touch target sizes for mobile devices

## Performance

- **Touch Detection**: Efficient device capability detection
- **Memory Management**: Proper cleanup of event listeners and timers
- **Optimized Rendering**: Minimal re-renders with proper memoization
- **Bundle Size**: Lightweight with tree-shaking support

## Migration from Standard Tooltip

### Before (Standard Tooltip)

```tsx
<Tooltip>
  <TooltipTrigger>
    <div className="flex items-center gap-1">
      Label
      <Info className="size-3" />
    </div>
  </TooltipTrigger>
  <TooltipContent>
    <p>Tooltip content</p>
  </TooltipContent>
</Tooltip>
```

### After (MobileFriendlyTooltip)

```tsx
<MobileFriendlyTooltip content="Tooltip content">Label</MobileFriendlyTooltip>
```

## Best Practices

1. **Use Descriptive Content**: Write clear, concise tooltip text
2. **Consistent Positioning**: Use consistent positioning across similar elements
3. **Appropriate Auto-Close**: Adjust auto-close timing based on content length
4. **Accessible Triggers**: Ensure trigger elements are keyboard accessible
5. **Performance**: Wrap large sections with `MobileFriendlyTooltipProvider` once
6. **Testing**: Test on both mobile and desktop devices

## Troubleshooting

### Tooltips Not Appearing on Mobile

- Ensure you're using `MobileFriendlyTooltipProvider`
- Check that touch events aren't being prevented by other elements
- Verify the trigger element is properly interactive

### Tooltips Closing Too Quickly

- Increase `autoCloseDelay` prop
- Set `autoCloseDelay={0}` for manual close only

### Styling Issues

- Use `triggerClassName` and `contentClassName` for custom styling
- Ensure CSS specificity is sufficient to override defaults
- Check for conflicting styles from parent components

### Performance Issues

- Use a single `MobileFriendlyTooltipProvider` at the app level
- Avoid creating multiple providers unnecessarily
- Consider lazy loading for components with many tooltips
