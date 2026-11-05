import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { C, S, Button, Icon } from '../ui';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../i18n';
import { ListenControl } from '../speech-access';
import { indiaDate, type ProfitInputs, type ProfitPlan } from '../profit';
import type { LanguageCode } from '../languages';
import { VoiceAction } from '../voice-command-context';

export function emptyProfitInputs(): ProfitInputs {
  return { stage: '', quantityQuintals: '', cultivationCost: '', routes: [0, 1].map(() => ({ market: '', pricePerQuintal: '', sellingCost: '', quotedOn: indiaDate() })) };
}

function Field({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (text: string) => void; numeric?: boolean }) {
  return <View style={{ gap: 7 }}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} placeholder={numeric ? '0' : 'Enter details'} value={value} onChangeText={onChange}
    keyboardType={numeric ? 'decimal-pad' : 'default'} style={styles.input} /></View>;
}

export function ProfitPlanner({ value, onChange, onCompare, busy, crop, location }: {
  value: ProfitInputs; onChange: (input: ProfitInputs) => void; onCompare: () => void; busy: boolean; crop: string; location: string;
}) {
  const [showSecondBuyer, setShowSecondBuyer] = useState(Boolean(value.routes[1]?.market));
  const updateRoute = (index: number, key: keyof ProfitInputs['routes'][number], text: string) => {
    onChange({ ...value, routes: value.routes.map((route, i) => i === index ? { ...route, [key]: text } : route) });
  };
  return <View style={styles.planner}>
    <View style={styles.sectionHeading}><View style={styles.number}><Text style={styles.numberText}>01</Text></View><View style={{ flex: 1 }}><Text style={S.sectionTitle}>Start with your harvest</Text><Text style={S.muted}>A clear picture of your costs and returns.</Text></View></View>
    <Text style={S.body}>{crop || 'Your crop'} · {location || 'Set your farm location in Profile'}</Text>
    <Text style={S.muted}>Compare harvesting and selling options using your actual offers and costs. Enter one buyer, or two to compare. You can dictate any field, then review it.</Text>
    <Text style={S.muted}>Current crop stage</Text>
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {([['growing', 'Still growing'], ['ready', 'Ready to harvest'], ['stored', 'Harvested / stored']] as const).map(([stage, label]) => <VoiceAction label={label} kind="select" key={stage} disabled={busy} onPress={() => onChange({ ...value, stage })}
        accessibilityRole="radio" accessibilityState={{ checked: value.stage === stage }} style={{ minHeight: 46, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: value.stage === stage ? C.green : C.border, backgroundColor: value.stage === stage ? C.green : C.white }}>
        <Text style={{ color: value.stage === stage ? C.white : C.greenDark }}>{label}</Text>
      </VoiceAction>)}
    </View>
    <Field label="Expected saleable harvest (quintals, 100 kg each)" value={value.quantityQuintals} numeric onChange={quantityQuintals => onChange({ ...value, quantityQuintals })} />
    <Field label="Total cultivation cost, spent + remaining (₹)" value={value.cultivationCost} numeric onChange={cultivationCost => onChange({ ...value, cultivationCost })} />
    <Text style={S.muted}>Include seed, labour, rent, irrigation, inputs, harvest and interest. Enter zero explicitly if a cost is zero. Enter selling costs separately without counting them twice.</Text>
    <View style={[styles.sectionHeading, { marginTop: 8 }]}><View style={styles.number}><Text style={styles.numberText}>02</Text></View><View style={{ flex: 1 }}><Text style={S.sectionTitle}>Compare your offers</Text><Text style={S.muted}>The best price may have higher selling costs.</Text></View></View>
    {value.routes.map((route, index) => index === 1 && !showSecondBuyer ? null : <View key={index} style={styles.buyer}>
      <View style={styles.sectionHeading}><Icon name={index === 0 ? 'storefront-outline' : 'compare-horizontal'} size={21} /><Text style={S.sectionTitle}>Buyer option {index + 1}</Text></View>
      <Field label="Buyer / mandi name" value={route.market} onChange={text => updateRoute(index, 'market', text)} />
      <Field label="Confirmed offer (₹ per quintal)" value={route.pricePerQuintal} numeric onChange={text => updateRoute(index, 'pricePerQuintal', text)} />
      <Field label="Total selling costs (₹ for the whole harvest)" value={route.sellingCost} numeric onChange={text => updateRoute(index, 'sellingCost', text)} />
      <Text style={S.muted}>Include this option’s transport, drying, bags, handling, storage, commission, deductions and additional interest.</Text>
      <Field label="Offer date (YYYY-MM-DD, within 7 days)" value={route.quotedOn} onChange={text => updateRoute(index, 'quotedOn', text)} />
    </View>)}
    {!showSecondBuyer ? <Button title="Add a second buyer to compare" secondary icon="plus" disabled={busy} onPress={() => setShowSecondBuyer(true)} /> : null}
    <Text style={S.muted}>Use offers for the same crop, variety and grade. The Market screen can help you find reference prices; confirm an actual buyer offer before entering it here.</Text>
    <Button title={busy ? 'Comparing your options…' : 'Find my best profit routes'} icon="chart-line" disabled={busy} onPress={onCompare} />
  </View>;
}

const rupees = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function ProfitPlanView({ plan, replyLanguage }: { plan: ProfitPlan; replyLanguage: LanguageCode }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [showAssumptions, setShowAssumptions] = useState(false);
  if (plan.status === 'needs-details') return <View style={{ gap: 7, marginTop: 12 }}>
    <Text style={S.sectionTitle}>Details needed for a profit estimate</Text>
    {plan.missing.map(item => <Text key={item} style={S.body}>• {item}</Text>)}
    <Text style={S.muted}>Complete the Profit routes form, then compare again.</Text>
  </View>;
  const narration = plan.routes.map(route => `Option ${route.rank}: ${route.market}. Estimated ${route.netProfit >= 0 ? 'profit' : 'loss'} ${rupees(Math.abs(route.netProfit))}. ${route.reasoning || ''} ${route.checklist.join(' ')}`).join(' ');
  return <View style={{ gap: 12, marginTop: 12 }}>
    <Text style={S.sectionTitle}>Top estimated routes among your options</Text>
    <ListenControl text={narration} language={plan.routes.every(route => route.guidanceSource === 'ai') ? replyLanguage : 'en-IN'} />
    {plan.routes.map(route => <View key={route.rank} style={[styles.result, route.rank === 1 && styles.leadingResult]}>
      <View style={styles.resultBadge}><Icon name={route.rank === 1 ? 'podium-gold' : 'swap-horizontal'} size={17} /><Text style={styles.fieldLabel}>{route.rank === 1 ? (route.netProfit >= 0 ? 'TOP ESTIMATED RETURN' : 'SMALLEST ESTIMATED LOSS') : 'ANOTHER OPTION'}</Text></View>
      <Text style={S.sectionTitle}>{route.rank}. {route.market}</Text>
      <Text style={S.muted}>{route.guidanceSource === 'ai' ? 'AI route guidance · calculated profit' : 'Standard checklist · AI route guidance unavailable'}</Text>
      {route.reasoning ? <Text style={S.body}>{route.reasoning}</Text> : null}
      <Text style={S.muted}>Estimated net {route.netProfit >= 0 ? 'profit' : 'loss'}</Text>
      <Text style={{ color: route.netProfit >= 0 ? C.greenDark : C.red, fontWeight: '800', fontSize: 30, lineHeight: 38, letterSpacing: -0.8 }}>{rupees(Math.abs(route.netProfit))}</Text>
      <Text style={S.body}>{route.quantityQuintals} quintals × {rupees(route.pricePerQuintal)} = {rupees(route.revenue)} revenue</Text>
      <Text style={S.body}>Cultivation: {rupees(route.cultivationCost)} · Selling: {rupees(route.sellingCost)}</Text>
      <Text style={S.body}>Break-even offer: {rupees(route.breakEvenPrice)} / quintal</Text>
      <Text style={S.muted}>At a 10% lower sale price: {route.profitAtLowerPrice >= 0 ? 'profit' : 'loss'} {rupees(Math.abs(route.profitAtLowerPrice))}. This is a stress check.</Text>
      <Text style={S.muted}>Farmer-entered offer dated {route.quotedOn}; reconfirm before selling.</Text>
      <View style={[styles.sectionHeading, { marginTop: 12 }]}><Text style={[S.sectionTitle, { flex: 1 }]}>Your next steps</Text><Text style={S.muted}>{route.checklist.filter((_, index) => checked[`${route.rank}-${index}`]).length}/{route.checklist.length}</Text></View>
      {route.checklist.map((step, index) => {
        const id = `${route.rank}-${index}`;
        return <Pressable key={id} accessibilityRole="checkbox" accessibilityLabel={step} accessibilityState={{ checked: Boolean(checked[id]) }}
          onPress={() => setChecked(current => ({ ...current, [id]: !current[id] }))} style={[styles.checklistRow, checked[id] && { opacity: 0.65 }]}>
          <Icon name={checked[id] ? 'checkbox-marked' : 'checkbox-blank-outline'} size={21} />
          <Text style={[S.body, { flex: 1, textDecorationLine: checked[id] ? 'line-through' : 'none' }]}>{step}</Text>
        </Pressable>;
      })}
    </View>)}
    <Text style={S.muted}>Estimates use your offers and costs. Reconfirm them before selling.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAssumptions }} onPress={() => setShowAssumptions(current => !current)} style={styles.sectionHeading}><Icon name="information-outline" size={19} /><Text style={styles.fieldLabel}>How this estimate works</Text><Icon name={showAssumptions ? 'chevron-up' : 'chevron-down'} size={18} /></Pressable>
    {showAssumptions ? plan.assumptions.map(item => <Text key={item} style={S.muted}>{item}</Text>) : null}
  </View>;
}

const styles = StyleSheet.create({
  planner: { padding: 16, gap: 16, backgroundColor: '#f6f7f1', borderWidth: 1, borderColor: C.border, borderRadius: 22, marginVertical: 14 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', minHeight: 44 },
  number: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#e3eadb', justifyContent: 'center', alignItems: 'center' },
  numberText: { color: C.greenDark, fontSize: 13, fontWeight: '800' },
  fieldLabel: { color: C.greenDark, fontSize: 12, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
  input: { borderWidth: 1, borderColor: '#d9e2d4', minHeight: 50, paddingHorizontal: 13, borderRadius: 14, backgroundColor: C.white, color: C.ink, fontSize: 15 },
  buyer: { gap: 13, padding: 14, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  result: { backgroundColor: C.white, borderRadius: 20, padding: 16, gap: 9, borderWidth: 1, borderColor: C.border },
  leadingResult: { borderColor: '#9eb99b', borderTopWidth: 4 },
  resultBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 5 },
  checklistRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 12, minHeight: 48, borderTopWidth: 1, borderTopColor: '#edf0e7' },
});
