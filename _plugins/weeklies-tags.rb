# frozen_string_literal: true

Jekyll::Hooks.register :site, :post_read do |site|
  site.collections.fetch("weeklies").docs.each do |weekly|
    raise Jekyll::Errors::FatalException, "Weekly #{weekly.relative_path} must define a date" unless weekly.date

    Array(weekly.data["tags"]).each do |tag|
      site.tags[tag] ||= []
      site.tags[tag] << weekly unless site.tags[tag].include?(weekly)
    end

    Array(weekly.data["categories"]).each do |category|
      site.categories[category] ||= []
      site.categories[category] << weekly unless site.categories[category].include?(weekly)
    end
  end

  site.tags.each_value { |documents| documents.sort_by!(&:date).reverse! }
  site.categories.each_value { |documents| documents.sort_by!(&:date).reverse! }
end
