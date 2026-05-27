import { useState, useMemo } from 'react';
import { Modal, TextInput, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { stitchShadows, stitchStyles, stitchTheme } from '../../theme/stitchTheme';

function getSurfaceTone(tone) {
  if (tone === 'muted') {
    return {
      backgroundColor: stitchTheme.colors.surfaceInset,
      borderColor: 'transparent',
    };
  }

  if (tone === 'success') {
    return {
      backgroundColor: stitchTheme.colors.successSurface,
      borderColor: 'transparent',
    };
  }

  if (tone === 'accent') {
    return {
      backgroundColor: stitchTheme.colors.primaryContainer,
      borderColor: 'transparent',
    };
  }

  if (tone === 'flat') {
    return {
      backgroundColor: stitchTheme.colors.surfaceHighlight,
      borderColor: 'transparent',
    };
  }

  if (tone === 'raised') {
    return {
      backgroundColor: stitchTheme.colors.surfaceRaised,
      borderColor: 'rgba(255,255,255,0.6)',
    };
  }

  return {
    backgroundColor: stitchTheme.colors.surface,
    borderColor: 'transparent',
  };
}

export function StitchScreen({ children, scroll = false, style, contentContainerStyle, ...props }) {
  if (scroll) {
    return (
      <ScrollView
        style={[styles.screen, style]}
        contentContainerStyle={[styles.screenContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[styles.screen, style]} {...props}>{children}</View>;
}

export function StitchTopBar({ title, subtitle, onBack, rightLabel, onRightPress, rightIcon = 'language-outline' }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        {onBack ? <StitchIconButton icon='arrow-back' onPress={onBack} /> : null}
        <View>
          <Text style={styles.topBarTitle}>{title}</Text>
          {subtitle ? <Text style={styles.topBarSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {onRightPress ? (
        rightLabel ? <StitchBadge label={rightLabel} tone='success' /> : <StitchIconButton icon={rightIcon} onPress={onRightPress} />
      ) : null}
    </View>
  );
}

export function StitchPageHeader({ eyebrow, title, subtitle, actionIcon, onActionPress, actionLabel, style }) {
  return (
    <View style={[styles.pageHeader, style]}>
      <View style={styles.pageHeaderBody}>
        {eyebrow ? <Text style={styles.pageKicker}>{eyebrow}</Text> : null}
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {onActionPress ? (
        <StitchIconButton icon={actionIcon || 'add'} onPress={onActionPress} style={styles.pageHeaderAction} />
      ) : actionLabel ? (
        <StitchBadge label={actionLabel} tone='success' />
      ) : null}
    </View>
  );
}

export function StitchIconButton({ icon, onPress, tone = 'neutral', active = false, style, iconSize = 20 }) {
  const palette = tone === 'success'
    ? { bg: stitchTheme.colors.successSurface, color: stitchTheme.colors.primary }
    : tone === 'warning'
      ? { bg: stitchTheme.colors.warningSurface, color: stitchTheme.colors.accentBrown }
      : { bg: stitchTheme.colors.surfaceFloating, color: stitchTheme.colors.primary };

  return (
    <TouchableOpacity style={[styles.iconButton, active && styles.iconButtonActive, { backgroundColor: palette.bg }, style]} onPress={onPress} activeOpacity={0.86}>
      <Ionicons name={icon} size={iconSize} color={palette.color} />
    </TouchableOpacity>
  );
}

export function StitchEyebrow({ children, style }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function StitchDisplayTitle({ children, style }) {
  return <Text style={[styles.displayTitle, style]}>{children}</Text>;
}

export function StitchSectionTitle({ children, style }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function StitchSectionHeader({ title, subtitle, action, actionLabel, style, titleStyle }) {
  const label = actionLabel || action;
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionHeaderBody}>
        <Text style={[styles.sectionHeaderTitle, titleStyle]}>{title}</Text>
        {subtitle ? <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text> : null}
      </View>
      {label ? <Text style={styles.sectionHeaderAction}>{label}</Text> : null}
    </View>
  );
}

export function StitchCard({ children, style, contentStyle, tone = 'default', compact = false, onPress, shadow = 'card' }) {
  const palette = getSurfaceTone(tone);
  const shadowStyle = shadow === 'soft' ? stitchShadows.soft : shadow === 'float' ? stitchShadows.float : stitchShadows.card;
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[styles.cardShell, shadowStyle, { borderColor: palette.borderColor }, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.9 : undefined}
    >
      <View style={[styles.cardInner, compact && styles.cardInnerCompact, { backgroundColor: palette.backgroundColor }, contentStyle]}>{children}</View>
    </Component>
  );
}

export function StitchSurface({ children, style, contentStyle, tone = 'default', compact = false }) {
  return <StitchCard style={style} contentStyle={contentStyle} tone={tone} compact={compact}>{children}</StitchCard>;
}

export function StitchStatCard({ title, value, subtitle, icon, tone = 'default', style }) {
  const palette = tone === 'accent'
    ? { iconBg: 'rgba(255,255,255,0.14)', iconColor: stitchTheme.colors.white, titleColor: '#d8f0d4', valueColor: stitchTheme.colors.white, subtitleColor: '#cae8c4' }
    : tone === 'warning'
      ? { iconBg: '#f7d8ca', iconColor: stitchTheme.colors.accentBrown, titleColor: stitchTheme.colors.textMuted, valueColor: stitchTheme.colors.text, subtitleColor: stitchTheme.colors.accentBrown }
      : { iconBg: stitchTheme.colors.surfaceMuted, iconColor: stitchTheme.colors.primary, titleColor: stitchTheme.colors.textMuted, valueColor: stitchTheme.colors.text, subtitleColor: stitchTheme.colors.accentBrown };

  return (
    <StitchCard style={style} compact tone={tone === 'accent' ? 'accent' : tone === 'warning' ? 'muted' : 'default'} shadow='soft'>
      <View style={styles.statCardTop}>
        <Text style={[styles.statCardTitle, { color: palette.titleColor }]} numberOfLines={1}>{title}</Text>
        {icon ? (
          <View style={[styles.statCardIconWrap, { backgroundColor: palette.iconBg }]}>
            <Ionicons name={icon} size={15} color={palette.iconColor} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.statCardValue, { color: palette.valueColor }]} numberOfLines={1}>{value}</Text>
      {subtitle ? <Text style={[styles.statCardSubtitle, { color: palette.subtitleColor }]} numberOfLines={2}>{subtitle}</Text> : null}
    </StitchCard>
  );
}

export function StitchBadge({ label, tone = 'neutral', style, textStyle }) {
  const palette = tone === 'success'
    ? { bg: stitchTheme.colors.successSurface, color: stitchTheme.colors.primary }
    : tone === 'warning'
      ? { bg: stitchTheme.colors.warningSurface, color: stitchTheme.colors.accentBrown }
      : { bg: stitchTheme.colors.chip, color: stitchTheme.colors.accentBrown };

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.badgeText, { color: palette.color }, textStyle]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function StitchChip({ label, active, onPress, style, textStyle, icon }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive, style]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? stitchTheme.colors.primary : stitchTheme.colors.accentBrown} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive, textStyle]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

export function StitchPrimaryButton({ label, onPress, disabled, loading, icon = 'checkmark-circle', style, tone = 'default' }) {
  const isSolid = tone === 'solid';

  return (
    <TouchableOpacity
      style={[styles.primaryButton, isSolid && styles.primaryButtonSolid, disabled && styles.primaryButtonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <Ionicons name={icon} size={20} color={isSolid ? stitchTheme.colors.white : stitchTheme.colors.primary} />
      <Text style={[styles.primaryButtonText, isSolid && styles.primaryButtonTextSolid]}>{loading ? '...' : label}</Text>
    </TouchableOpacity>
  );
}

export function StitchInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  icon,
  secureTextEntry,
  keyboardType,
  multiline,
  style,
  onPress,
  autoCapitalize,
  autoCorrect,
  autoFocus,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  trailing,
  inputStyle,
}) {
  const [focused, setFocused] = useState(false);

  const shell = (
    <View style={[styles.inputShell, focused && styles.inputShellFocused, error && styles.inputShellError]}>
      {icon ? <Ionicons name={icon} size={18} color={error ? stitchTheme.colors.accentRed : focused ? stitchTheme.colors.primaryContainer : stitchTheme.colors.textMuted} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={stitchTheme.colors.textMuted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={!onPress}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoFocus={autoFocus}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => { if (!onPress) setFocused(true); }}
        onBlur={() => setFocused(false)}
        style={[styles.inputField, multiline && styles.inputFieldMultiline, inputStyle]}
      />
      {trailing}
    </View>
  );

  return (
    <View style={[styles.inputWrap, style]}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
          {shell}
        </TouchableOpacity>
      ) : shell}
      {error ? <Text style={styles.inputError}>{error}</Text> : null}
    </View>
  );
}

export function StitchListRow({ icon, title, subtitle, tint = stitchTheme.colors.successSurface, iconColor = stitchTheme.colors.primary, rightText, onPress, style }) {
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component style={[styles.listRow, style]} onPress={onPress} activeOpacity={onPress ? 0.88 : undefined}>
      <View style={[styles.listRowIconWrap, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.listRowBody}>
        <Text style={styles.listRowTitle}>{title}</Text>
        <Text style={styles.listRowSubtitle}>{subtitle}</Text>
      </View>
      {rightText ? <Text style={styles.listRowValue}>{rightText}</Text> : <Ionicons name='chevron-forward' size={20} color={stitchTheme.colors.textMuted} />}
    </Component>
  );
}

export function StitchBlockPicker({
  blocks,
  selectedValue,
  onSelect,
  label,
  title,
  placeholder = 'Select block',
  searchPlaceholder = 'Search blocks',
  allowClear = false,
  clearLabel = 'Overall',
  getSubtitle,
  icon = 'layers-outline',
  tint = stitchTheme.colors.accentBrown,
  style,
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const selectedBlock = useMemo(
    () => (blocks || []).find((block) => block.id === selectedValue) || null,
    [blocks, selectedValue]
  );

  const filteredBlocks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return blocks || [];
    return (blocks || []).filter((block) => block.name.toLowerCase().includes(query));
  }, [blocks, search]);

  const activeLabel = selectedBlock
    ? selectedBlock.name
    : allowClear && !selectedValue
      ? clearLabel
      : placeholder;
  const modalTitle = title || label || t('projects.tabs.block', { defaultValue: 'Block' });

  if (!blocks || blocks.length === 0) {
    return null;
  }

  const handleSelect = (value) => {
    onSelect(value);
    setVisible(false);
    setSearch('');
  };

  return (
    <View style={style}>
      <TouchableOpacity style={styles.blockSelector} onPress={() => setVisible(true)} activeOpacity={0.88}>
        <View style={[styles.blockSelectorIconWrap, { backgroundColor: tint + '20' }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        <View style={styles.blockSelectorBody}>
          {label ? <Text style={styles.blockSelectorLabel}>{label}</Text> : null}
          <Text style={styles.blockSelectorValue} numberOfLines={1}>{activeLabel}</Text>
        </View>
        <Ionicons name='chevron-down' size={18} color={stitchTheme.colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={visible} animationType='slide' transparent onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.blockPickerOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.blockPickerSheet}>
            <View style={styles.blockPickerHandle} />
            <View style={styles.blockPickerHeader}>
              <Text style={styles.blockPickerTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => setVisible(false)} activeOpacity={0.88}>
                <Ionicons name='close-outline' size={22} color={stitchTheme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.blockPickerSearchShell}>
              <Ionicons name='search-outline' size={18} color={stitchTheme.colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={searchPlaceholder}
                placeholderTextColor={stitchTheme.colors.textMuted}
                style={styles.blockPickerSearchInput}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.blockPickerList}>
              {allowClear ? (
                <TouchableOpacity
                  style={[styles.blockPickerOption, !selectedBlock && styles.blockPickerOptionActive]}
                  onPress={() => handleSelect('')}
                  activeOpacity={0.88}
                >
                  <View>
                    <Text style={styles.blockPickerOptionTitle}>{clearLabel}</Text>
                    <Text style={styles.blockPickerOptionMeta}>{t('common.none', { defaultValue: 'All blocks' })}</Text>
                  </View>
                  {!selectedBlock ? <Ionicons name='checkmark-circle' size={18} color={stitchTheme.colors.primaryContainer} /> : null}
                </TouchableOpacity>
              ) : null}

              {filteredBlocks.map((block) => {
                const active = selectedValue === block.id;
                const subtitle = getSubtitle ? getSubtitle(block) : (block.crop || t('projects.fields.crop'));

                return (
                  <TouchableOpacity
                    key={block.id}
                    style={[styles.blockPickerOption, active && styles.blockPickerOptionActive]}
                    onPress={() => handleSelect(block.id)}
                    activeOpacity={0.88}
                  >
                    <View>
                      <Text style={styles.blockPickerOptionTitle}>{block.name}</Text>
                      <Text style={styles.blockPickerOptionMeta}>{subtitle}</Text>
                    </View>
                    {active ? <Ionicons name='checkmark-circle' size={18} color={stitchTheme.colors.primaryContainer} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export function StitchPicker({ label, options, selectedValue, onSelect, searchable, placeholder }) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = searchable && search.trim()
    ? options.filter((opt) => opt.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const selected = options.find((opt) => opt.value === selectedValue);

  return (
    <View style={styles.pickerWrap}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TouchableOpacity style={styles.pickerShell} onPress={() => setVisible(true)} activeOpacity={0.88}>
        <Ionicons name='chevron-down' size={16} color={stitchTheme.colors.textMuted} />
        <Text style={[styles.pickerText, !selected && styles.pickerPlaceholder]} numberOfLines={1}>
          {selected ? selected.label : (placeholder || 'Select')}
        </Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType='fade' onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} onPress={() => setVisible(false)}>
          <View style={styles.pickerSheet}>
            {searchable ? (
              <TextInput
                style={styles.pickerSearch}
                value={search}
                onChangeText={setSearch}
                placeholder='Search...'
                placeholderTextColor={stitchTheme.colors.textMuted}
              />
            ) : null}
            <ScrollView style={styles.pickerOptions}>
              {filtered.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pickerOption, opt.value === selectedValue && styles.pickerOptionActive]}
                  onPress={() => { onSelect(opt.value); setVisible(false); setSearch(''); }}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.pickerOptionText, opt.value === selectedValue && styles.pickerOptionTextActive]}>{opt.label}</Text>
                  {opt.value === selectedValue ? <Ionicons name='checkmark-circle' size={18} color={stitchTheme.colors.primaryContainer} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  let week = new Array(7).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = (firstDay + d - 1) % 7;
    week[dayOfWeek] = d;
    if (dayOfWeek === 6 || d === daysInMonth) {
      grid.push(week);
      week = new Array(7).fill(null);
    }
  }
  return grid;
}

export function StitchDatePicker({ visible, date, onDateChange, onClose }) {
  const { t } = useTranslation();
  const MONTHS = useMemo(() => [
    t('months.january'), t('months.february'), t('months.march'),
    t('months.april'), t('months.may'), t('months.june'),
    t('months.july'), t('months.august'), t('months.september'),
    t('months.october'), t('months.november'), t('months.december'),
  ], [t]);
  const DAYS = useMemo(() => [
    t('days.sunday'), t('days.monday'), t('days.tuesday'),
    t('days.wednesday'), t('days.thursday'), t('days.friday'),
    t('days.saturday'),
  ], [t]);
  const [viewYear, setViewYear] = useState(date.getFullYear());
  const [viewMonth, setViewMonth] = useState(date.getMonth());
  const today = new Date();
  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const isToday = (d) => d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const isSelected = (d) => d === date.getDate() && viewMonth === date.getMonth() && viewYear === date.getFullYear();

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} onPress={onClose}>
        <View style={styles.datePickerSheet}>
          <View style={styles.pickerHandle} />

          <View style={styles.datePickerHeader}>
            <Text style={styles.datePickerTitle}>Select Date</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.88}>
              <Ionicons name='close-outline' size={24} color={stitchTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.datePickerNav}>
            <TouchableOpacity onPress={() => {
              if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
              else { setViewMonth(viewMonth - 1); }
            }} activeOpacity={0.8} style={styles.datePickerNavBtn}>
              <Ionicons name='chevron-back' size={20} color={stitchTheme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.datePickerNavLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={() => {
              if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
              else { setViewMonth(viewMonth + 1); }
            }} activeOpacity={0.8} style={styles.datePickerNavBtn}>
              <Ionicons name='chevron-forward' size={20} color={stitchTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.datePickerWeekRow}>
            {DAYS.map((d) => (
              <View key={d} style={styles.datePickerWeekCell}>
                <Text style={styles.datePickerWeekText}>{d}</Text>
              </View>
            ))}
          </View>

          <View style={styles.datePickerGrid}>
            {grid.map((week, wi) => (
              <View key={wi} style={styles.datePickerWeekRow}>
                {week.map((d, di) => (
                  <TouchableOpacity
                    key={`${wi}-${di}`}
                    style={[
                      styles.datePickerDayCell,
                      isSelected(d) && styles.datePickerDayCellSelected,
                      isToday(d) && !isSelected(d) && styles.datePickerDayCellToday,
                    ]}
                    onPress={() => {
                      if (d) onDateChange(new Date(viewYear, viewMonth, d));
                    }}
                    activeOpacity={0.88}
                    disabled={!d}
                  >
                    <Text style={[
                      styles.datePickerDayText,
                      isSelected(d) && styles.datePickerDayTextSelected,
                      isToday(d) && !isSelected(d) && styles.datePickerDayTextToday,
                      !d && styles.datePickerDayTextEmpty,
                    ]}>{d || ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.datePickerTodayBtn}
            onPress={() => { onDateChange(new Date()); setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
            activeOpacity={0.88}
          >
            <Ionicons name='calendar-outline' size={16} color={stitchTheme.colors.primary} />
            <Text style={styles.datePickerTodayText}>Today</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function StitchMiniBars({ values, activeIndex = -1, softIndex = -1, style }) {
  const maxValue = Math.max(...values, 1);

  return (
    <View style={[styles.miniBars, style]}>
      {values.map((value, index) => {
        let backgroundColor = stitchTheme.colors.surfaceMuted;
        if (index === activeIndex) backgroundColor = stitchTheme.colors.primaryContainer;
        else if (index === softIndex) backgroundColor = stitchTheme.colors.primarySoft;

        return (
          <View
            key={`${value}-${index}`}
            style={[
              styles.miniBar,
              {
                height: `${Math.max(24, (value / maxValue) * 100)}%`,
                backgroundColor,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

export function StitchSkeletonBlock({ style }) {
  return <View style={[styles.skeletonBlock, style]} />;
}

export function StitchSearchBar({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.searchBar}>
      <Ionicons name='search-outline' size={16} color={stitchTheme.colors.textMuted} />
      <TextInput
        style={styles.searchBarInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={stitchTheme.colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: stitchTheme.colors.background,
  },
  screenContent: {
    paddingHorizontal: stitchTheme.spacing.screen,
    paddingTop: stitchTheme.spacing.md,
    paddingBottom: 120,
    gap: stitchTheme.spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: stitchTheme.spacing.lg,
    gap: stitchTheme.spacing.sm,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.sm,
    flex: 1,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: stitchTheme.spacing.md,
  },
  pageHeaderBody: {
    flex: 1,
  },
  pageKicker: {
    fontSize: stitchTheme.typography.pageKicker.fontSize,
    lineHeight: stitchTheme.typography.pageKicker.lineHeight,
    fontWeight: stitchTheme.typography.pageKicker.fontWeight,
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.accentBrown,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pageTitle: {
    marginTop: stitchTheme.spacing.xs,
    fontSize: stitchTheme.typography.pageTitle.fontSize,
    lineHeight: stitchTheme.typography.pageTitle.lineHeight,
    fontWeight: stitchTheme.typography.pageTitle.fontWeight,
    fontFamily: stitchTheme.fonts.display,
    color: stitchTheme.colors.primary,
  },
  pageSubtitle: {
    marginTop: stitchTheme.spacing.xs,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    color: stitchTheme.colors.textMuted,
    maxWidth: 260,
  },
  pageHeaderAction: {
    marginTop: 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    ...stitchShadows.soft,
  },
  iconButtonActive: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  topBarTitle: {
    fontSize: stitchTheme.typography.title.fontSize,
    lineHeight: stitchTheme.typography.title.lineHeight,
    fontWeight: stitchTheme.typography.title.fontWeight,
    fontFamily: stitchTheme.fonts.heading,
    color: stitchTheme.colors.primary,
  },
  topBarSubtitle: {
    marginTop: 2,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '700',
    fontFamily: stitchTheme.fonts.body,
    color: stitchTheme.colors.textMuted,
  },
  eyebrow: {
    fontSize: stitchTheme.typography.label.fontSize,
    lineHeight: stitchTheme.typography.label.lineHeight,
    fontWeight: stitchTheme.typography.label.fontWeight,
    fontFamily: stitchTheme.fonts.label,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: stitchTheme.colors.accentBrown,
  },
  displayTitle: {
    marginTop: stitchTheme.spacing.xs,
    fontSize: stitchTheme.typography.display.fontSize,
    lineHeight: stitchTheme.typography.display.lineHeight,
    fontWeight: stitchTheme.typography.display.fontWeight,
    fontFamily: stitchTheme.fonts.display,
    color: stitchTheme.colors.primary,
  },
  sectionLabel: {
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '800',
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.accentBrown,
    marginBottom: stitchTheme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: stitchTheme.spacing.sm,
  },
  sectionHeaderBody: {
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: stitchTheme.typography.section.fontSize,
    lineHeight: stitchTheme.typography.section.lineHeight,
    fontWeight: stitchTheme.typography.section.fontWeight,
    fontFamily: stitchTheme.fonts.heading,
    color: stitchTheme.colors.primary,
  },
  sectionHeaderSubtitle: {
    marginTop: 4,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    color: stitchTheme.colors.textMuted,
  },
  sectionHeaderAction: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '700',
    color: stitchTheme.colors.accentBrown,
  },
  cardShell: {
    borderRadius: stitchTheme.radius.card,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cardInner: {
    borderRadius: stitchTheme.radius.card,
    padding: stitchTheme.spacing.md,
  },
  cardInnerCompact: {
    padding: stitchTheme.spacing.sm,
  },
  statCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: stitchTheme.spacing.sm,
  },
  statCardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardTitle: {
    flex: 1,
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '800',
  },
  statCardValue: {
    marginTop: stitchTheme.spacing.sm,
    fontSize: stitchTheme.typography.title.fontSize,
    lineHeight: stitchTheme.typography.title.lineHeight,
    fontWeight: '900',
  },
  statCardSubtitle: {
    marginTop: 6,
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: stitchTheme.radius.pill,
  },
  badgeText: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: stitchTheme.radius.pill,
    backgroundColor: stitchTheme.colors.chip,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipActive: {
    backgroundColor: stitchTheme.colors.chipActive,
    borderColor: 'transparent',
  },
  chipText: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '800',
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.accentBrown,
  },
  chipTextActive: {
    color: stitchTheme.colors.primary,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: stitchTheme.radius.card,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: stitchTheme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
    ...stitchShadows.float,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonSolid: {
    backgroundColor: stitchTheme.colors.primaryContainer,
    borderColor: 'transparent',
  },
  primaryButtonText: {
    color: stitchTheme.colors.primary,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    fontWeight: '900',
  },
  primaryButtonTextSolid: {
    color: stitchTheme.colors.white,
  },
  miniBars: {
    height: 86,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: stitchTheme.spacing.xs,
  },
  miniBar: {
    flex: 1,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    minHeight: 20,
  },
  searchBar: {
    minHeight: 48,
    borderRadius: stitchTheme.radius.md,
    backgroundColor: stitchTheme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.sm,
    paddingHorizontal: 14,
  },
  searchBarInput: {
    flex: 1,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    color: stitchTheme.colors.text,
  },
  skeletonBlock: {
    backgroundColor: stitchTheme.colors.surfaceInset,
    borderRadius: 10,
  },

  inputWrap: { gap: 6 },
  inputLabel: { fontSize: stitchTheme.typography.label.fontSize, lineHeight: stitchTheme.typography.label.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    borderRadius: stitchTheme.radius.md,
    backgroundColor: stitchTheme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    paddingHorizontal: stitchTheme.spacing.md,
  },
  inputShellFocused: { borderColor: stitchTheme.colors.primaryContainer },
  inputShellError: { borderColor: stitchTheme.colors.accentRed },
  inputField: {
    flex: 1,
    fontSize: stitchTheme.typography.body.fontSize,
    lineHeight: stitchTheme.typography.body.lineHeight,
    color: stitchTheme.colors.text,
    fontWeight: '700',
    paddingVertical: 16,
  },
  inputFieldMultiline: { minHeight: 100, textAlignVertical: 'top' },
  inputError: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.accentRed, fontWeight: '700' },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stitchTheme.spacing.md,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderRadius: stitchTheme.radius.card,
    paddingHorizontal: stitchTheme.spacing.md,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    ...stitchShadows.card,
  },
  listRowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: stitchTheme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowBody: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: stitchTheme.typography.cardTitle.fontSize,
    lineHeight: stitchTheme.typography.cardTitle.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.text,
    fontFamily: stitchTheme.fonts.heading,
  },
  listRowSubtitle: {
    marginTop: 2,
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    color: stitchTheme.colors.accentBrown,
  },
  listRowValue: {
    fontSize: stitchTheme.typography.caption.fontSize,
    lineHeight: stitchTheme.typography.caption.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.primary,
    textTransform: 'uppercase',
  },

  blockSelector: {
    ...stitchStyles.collectionCard,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  blockSelectorIconWrap: {
    width: 36,
    height: 36,
    borderRadius: stitchTheme.radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockSelectorBody: {
    flex: 1,
  },
  blockSelectorLabel: {
    fontSize: stitchTheme.typography.eyebrow.fontSize,
    lineHeight: stitchTheme.typography.eyebrow.lineHeight,
    fontWeight: stitchTheme.typography.eyebrow.fontWeight,
    fontFamily: stitchTheme.fonts.label,
    color: stitchTheme.colors.textMuted,
  },
  blockSelectorValue: {
    marginTop: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: stitchTheme.colors.text,
    fontFamily: stitchTheme.fonts.heading,
  },
  blockPickerOverlay: {
    flex: 1,
    backgroundColor: stitchTheme.colors.scrim,
    justifyContent: 'flex-end',
  },
  blockPickerSheet: {
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    borderTopLeftRadius: stitchTheme.radius.xl,
    borderTopRightRadius: stitchTheme.radius.xl,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  blockPickerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: stitchTheme.colors.line,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  blockPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  blockPickerTitle: {
    fontSize: stitchTheme.typography.section.fontSize,
    lineHeight: stitchTheme.typography.section.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  blockPickerSearchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 12,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: stitchTheme.radius.md,
    backgroundColor: stitchTheme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
  },
  blockPickerSearchInput: {
    flex: 1,
    fontSize: stitchTheme.typography.body.fontSize,
    lineHeight: stitchTheme.typography.body.lineHeight,
    color: stitchTheme.colors.text,
  },
  blockPickerList: {
    paddingHorizontal: 24,
    gap: 4,
  },
  blockPickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: stitchTheme.radius.md,
  },
  blockPickerOptionActive: {
    backgroundColor: stitchTheme.colors.surfaceTint,
  },
  blockPickerOptionTitle: {
    fontSize: stitchTheme.typography.body.fontSize,
    lineHeight: stitchTheme.typography.body.lineHeight,
    fontWeight: '800',
    color: stitchTheme.colors.text,
  },
  blockPickerOptionMeta: {
    fontSize: stitchTheme.typography.bodySmall.fontSize,
    lineHeight: stitchTheme.typography.bodySmall.lineHeight,
    color: stitchTheme.colors.textMuted,
    marginTop: 2,
  },

  pickerWrap: { gap: 6 },
  pickerShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 60,
    borderRadius: stitchTheme.radius.md,
    backgroundColor: stitchTheme.colors.surfaceInset,
    borderWidth: 1,
    borderColor: stitchTheme.colors.border,
    paddingHorizontal: stitchTheme.spacing.md,
  },
  pickerText: { flex: 1, fontSize: stitchTheme.typography.body.fontSize, lineHeight: stitchTheme.typography.body.lineHeight, color: stitchTheme.colors.text, fontWeight: '700' },
  pickerPlaceholder: { color: stitchTheme.colors.textMuted },
  pickerOverlay: { flex: 1, backgroundColor: stitchTheme.colors.scrim, justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: stitchTheme.colors.background,
    borderTopLeftRadius: stitchTheme.radius.xl,
    borderTopRightRadius: stitchTheme.radius.xl,
    paddingHorizontal: stitchTheme.spacing.md,
    paddingTop: stitchTheme.spacing.sm,
    paddingBottom: stitchTheme.spacing.lg,
    maxHeight: '70%',
  },
  pickerSearch: {
    minHeight: 48,
    borderRadius: stitchTheme.radius.md,
    backgroundColor: stitchTheme.colors.surfaceInset,
    paddingHorizontal: stitchTheme.spacing.md,
    fontSize: stitchTheme.typography.body.fontSize,
    lineHeight: stitchTheme.typography.body.lineHeight,
    color: stitchTheme.colors.text,
    marginBottom: stitchTheme.spacing.sm,
  },
  pickerOptions: { gap: 4 },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
    borderRadius: stitchTheme.radius.md,
    paddingHorizontal: stitchTheme.spacing.md,
    backgroundColor: stitchTheme.colors.surfaceHighlight,
    marginBottom: stitchTheme.spacing.xs,
  },
  pickerOptionActive: { backgroundColor: stitchTheme.colors.surfaceTint },
  pickerOptionText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.text, fontWeight: '800' },
  pickerOptionTextActive: { color: stitchTheme.colors.primary },

  pickerHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: stitchTheme.colors.line, marginBottom: stitchTheme.spacing.sm },

  datePickerSheet: {
    backgroundColor: stitchTheme.colors.background,
    borderTopLeftRadius: stitchTheme.radius.xl,
    borderTopRightRadius: stitchTheme.radius.xl,
    paddingHorizontal: stitchTheme.spacing.md,
    paddingTop: stitchTheme.spacing.sm,
    paddingBottom: stitchTheme.spacing.lg,
  },
  datePickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: stitchTheme.spacing.sm },
  datePickerTitle: { fontSize: stitchTheme.typography.title.fontSize, lineHeight: stitchTheme.typography.title.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  datePickerNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: stitchTheme.spacing.sm },
  datePickerNavBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: stitchTheme.colors.surfaceInset, alignItems: 'center', justifyContent: 'center' },
  datePickerNavLabel: { fontSize: stitchTheme.typography.cardTitle.fontSize, lineHeight: stitchTheme.typography.cardTitle.lineHeight, fontWeight: '800', color: stitchTheme.colors.text },
  datePickerWeekRow: { flexDirection: 'row', marginBottom: 4 },
  datePickerWeekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  datePickerWeekText: { fontSize: stitchTheme.typography.caption.fontSize, lineHeight: stitchTheme.typography.caption.lineHeight, color: stitchTheme.colors.textMuted, fontWeight: '800', textTransform: 'uppercase' },
  datePickerGrid: { gap: 2, marginBottom: stitchTheme.spacing.sm },
  datePickerDayCell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: stitchTheme.radius.md },
  datePickerDayCellSelected: { backgroundColor: stitchTheme.colors.primaryContainer },
  datePickerDayCellToday: { backgroundColor: stitchTheme.colors.surfaceTint },
  datePickerDayText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.text, fontWeight: '700' },
  datePickerDayTextSelected: { color: stitchTheme.colors.surfaceHighlight, fontWeight: '900' },
  datePickerDayTextToday: { color: stitchTheme.colors.primaryContainer, fontWeight: '900' },
  datePickerDayTextEmpty: { color: 'transparent' },
  datePickerTodayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: stitchTheme.spacing.sm, borderRadius: stitchTheme.radius.md, borderWidth: 1, borderColor: stitchTheme.colors.border, backgroundColor: stitchTheme.colors.surfaceHighlight },
  datePickerTodayText: { fontSize: stitchTheme.typography.bodySmall.fontSize, lineHeight: stitchTheme.typography.bodySmall.lineHeight, color: stitchTheme.colors.primary, fontWeight: '800' },
});
